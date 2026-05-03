/**
 * TODO: Remove this controller before production deployment.
 * For dev/demo reset only.
 *
 * Houses admin-only utilities that mutate state in ways production
 * users should never be able to trigger. Authorization is enforced at
 * the route layer (authorize('lgc')).
 */

const mongoose = require('mongoose');
const Application = require('../models/Application');
const Cycle = require('../models/Cycle');
const MatchRun = require('../models/MatchRun');
const Program = require('../models/Program');
const ProgramRanking = require('../models/ProgramRanking');

/**
 * POST /api/admin/reset-cycle/:cycleId
 *
 * Full "pre-matching" rewind for a cycle:
 *   1. Applications in matched/unmatched → submitted; matchedProgram →
 *      null; offerStatus → none; offerExpiresAt unset. Drafts,
 *      under_review, submitted, and withdrawn are left alone.
 *   2. All MatchRun documents for the cycle are deleted (dry + official).
 *   3. Program.availableSeats is reset to the Program's capacity for
 *      every program in the cycle (executeMatch mutates this).
 *   4. If Cycle.status is matching or published, it drops back to
 *      'ranking' so matching can be re-run. Other statuses are left
 *      alone (ranking / review / open / draft / closed).
 */
exports.resetCycle = async (req, res) => {
  try {
    const { cycleId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(cycleId)) {
      return res.status(400).json({ error: 'Invalid cycle ID' });
    }

    const cycle = await Cycle.findById(cycleId);
    if (!cycle) {
      return res.status(404).json({ error: 'Cycle not found' });
    }

    const applicationResult = await Application.updateMany(
      { cycle: cycleId, status: { $in: ['matched', 'unmatched'] } },
      {
        $set: {
          status: 'submitted',
          matchedProgram: null,
          offerStatus: 'none',
        },
        $unset: { offerExpiresAt: '' },
      }
    );

    const matchRunResult = await MatchRun.deleteMany({ cycle: cycleId });

    // Delete every ProgramRanking for this cycle — both drafts and
    // submitted. Drafts come from the legacy `getProgramRanking`
    // auto-create side effect plus any real reviewer drafts, and
    // submitted rankings are stale once applications reset. Leaving
    // them behind was the root cause of bulk-submit silently skipping
    // programs on subsequent demo runs.
    const rankingResult = await ProgramRanking.deleteMany({ cycle: cycleId });

    // Aggregation-pipeline update so we can reference the document's own
    // `capacity` field when rewriting `availableSeats`. Mongoose 9.x
    // requires the explicit `updatePipeline: true` opt-in to accept an
    // array update — without it, query.js throws "Cannot pass an array
    // to query updates unless the `updatePipeline` option is set."
    const programResult = await Program.updateMany(
      { cycle: cycleId },
      [{ $set: { availableSeats: '$capacity' } }],
      { updatePipeline: true }
    );

    let cycleStatusReset = false;
    if (cycle.status === 'matching' || cycle.status === 'published') {
      cycle.status = 'ranking';
      await cycle.save();
      cycleStatusReset = true;
    }

    return res.status(200).json({
      applicationsReset: applicationResult.modifiedCount ?? 0,
      matchRunsDeleted: matchRunResult.deletedCount ?? 0,
      rankingsDeleted: rankingResult.deletedCount ?? 0,
      programsReset: programResult.modifiedCount ?? 0,
      cycleStatusReset,
      message: 'Cycle reset to pre-matching state',
    });
  } catch (error) {
    console.error('Reset cycle error:', error);
    return res.status(500).json({ error: error.message });
  }
};

/**
 * POST /api/admin/bulk-submit-rankings/:cycleId
 *
 * For each program in the cycle that doesn't already have a
 * ProgramRanking document, create one with status='submitted' and
 * rankedApplicants built from the applications that selected that
 * program (sorted by submittedAt ASC). Programs with an existing
 * ranking (draft OR submitted) are left alone.
 *
 * Observed behavior worth knowing: programs with zero applicants end
 * up WITHOUT a ranking document after this endpoint runs. The
 * rankedApplicants array for those is empty, and Mongoose / MongoDB
 * drop them during the batched insertMany (the matching frontend's
 * readiness check treats "programs with applicants" as the denominator
 * precisely so this is fine — an unranked empty program is invisible
 * to the match and to the readiness indicator). If that ever changes
 * and empty rankings start persisting, the readiness logic still works
 * because it keys off applicant presence, not ranking presence.
 *
 * Four DB round trips regardless of program count:
 *   1. Program.find
 *   2. ProgramRanking.find (existing for cycle)
 *   3. Application.find (all visible apps for cycle)
 *   4. ProgramRanking.insertMany (batched)
 *
 * If some programs already have DRAFT rankings and you need them
 * promoted to submitted, this endpoint won't help — matches spec. Ask
 * to expand if that's blocking matching.
 */
exports.bulkSubmitRankings = async (req, res) => {
  try {
    const { cycleId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(cycleId)) {
      return res.status(400).json({ error: 'Invalid cycle ID' });
    }
    const cycle = await Cycle.findById(cycleId).select('_id');
    if (!cycle) {
      return res.status(404).json({ error: 'Cycle not found' });
    }

    const programs = await Program.find({
      cycle: cycleId,
      isActive: true,
    }).select('_id');

    if (programs.length === 0) {
      return res.status(200).json({
        programsProcessed: 0,
        rankingsCreated: 0,
        rankingsSubmitted: 0,
        message: 'No programs in this cycle',
      });
    }

    const programIds = programs.map((p) => p._id);

    const existingRankings = await ProgramRanking.find({
      cycle: cycleId,
      program: { $in: programIds },
    }).select('program status');
    const existingByProgram = new Map(
      existingRankings.map((r) => [r.program.toString(), r])
    );
    const preExistingSubmitted = existingRankings.filter(
      (r) => r.status === 'submitted'
    ).length;

    // Match the matching algorithm's view of applicants exactly — it
    // only uses status='submitted'. Including 'under_review' here
    // produced rankings for programs that matching would silently skip
    // (because those applicants aren't visible to the algorithm),
    // which caused bulk-submit's numbers to disagree with the Matching
    // page readiness indicator.
    const apps = await Application.find({
      cycle: cycleId,
      status: 'submitted',
    }).select('_id applicant submittedAt selections');

    const now = new Date();
    const docsToInsert = [];

    for (const program of programs) {
      if (existingByProgram.has(program._id.toString())) continue;

      const programApps = apps
        .filter((app) =>
          app.selections.some(
            (s) => s.program.toString() === program._id.toString()
          )
        )
        .sort((a, b) => {
          const ta = a.submittedAt ? new Date(a.submittedAt).getTime() : 0;
          const tb = b.submittedAt ? new Date(b.submittedAt).getTime() : 0;
          return ta - tb;
        });

      docsToInsert.push({
        program: program._id,
        cycle: cycleId,
        rankedApplicants: programApps.map((app, i) => ({
          applicant: app.applicant,
          application: app._id,
          rank: i + 1,
        })),
        status: 'submitted',
        submittedAt: now,
        submittedBy: req.user._id,
      });
    }

    let rankingsCreated = 0;
    if (docsToInsert.length > 0) {
      const inserted = await ProgramRanking.insertMany(docsToInsert);
      rankingsCreated = inserted.length;
    }

    return res.status(200).json({
      programsProcessed: programs.length,
      rankingsCreated,
      rankingsSubmitted: preExistingSubmitted + rankingsCreated,
      message: 'Bulk ranking submission complete',
    });
  } catch (error) {
    console.error('Bulk submit rankings error:', error);
    return res.status(500).json({ error: error.message });
  }
};
