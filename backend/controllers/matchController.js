const Application = require('../models/Application');
const ProgramRanking = require('../models/ProgramRanking');
const Program = require('../models/Program');
const Cycle = require('../models/Cycle');
const MatchRun = require('../models/MatchRun');
const Notification = require('../models/Notification');
const ApplicationReviewState = require('../models/ApplicationReviewState');
const { runGaleShapley } = require('../utils/matching');
const { logAction } = require('../utils/audit');
const { sendEmail, matchPublishedTemplate, matchUnmatchedTemplate } = require('../utils/email');

const gatherInputs = async (cycleId, track) => {
  const submittedApplications = await Application.find({
    cycle: cycleId,
    track,
    status: 'submitted',
  }).populate('applicant', 'createdAt');

  const programs = await Program.find({
    cycle: cycleId,
    track,
    isActive: true,
  });

  const programIds = programs.map((p) => p._id);
  const rankings = await ProgramRanking.find({
    program: { $in: programIds },
    cycle: cycleId,
    status: 'submitted',
  });

  const rankingByProgram = new Map();
  for (const r of rankings) {
    rankingByProgram.set(
      r.program.toString(),
      r.rankedApplicants
        .sort((a, b) => a.rank - b.rank)
        .map((ra) => ra.applicant.toString())
    );
  }

  const applicantsInput = submittedApplications.map((app) => {
    const sortedSelections = [...app.selections].sort((a, b) => a.rank - b.rank);
    return {
      id: app.applicant._id.toString(),
      applicationId: app._id.toString(),
      submittedAt: app.submittedAt,
      preferences: sortedSelections.map((s) => s.program.toString()),
    };
  });

  const programsInput = programs
    .filter((p) => rankingByProgram.has(p._id.toString()))
    .map((p) => ({
      id: p._id.toString(),
      capacity: p.capacity,
      rankedApplicants: rankingByProgram.get(p._id.toString()),
    }));

  return { applicantsInput, programsInput, submittedApplications, programs };
};

exports.dryRun = async (req, res) => {
  try {
    const { cycleId, track } = req.body;

    const cycle = await Cycle.findById(cycleId);
    if (!cycle) return res.status(404).json({ error: 'Cycle not found' });

    const { applicantsInput, programsInput } = await gatherInputs(cycleId, track);

    if (applicantsInput.length === 0) {
      return res.status(400).json({ error: 'No submitted applications for this cycle and track' });
    }
    if (programsInput.length === 0) {
      return res.status(400).json({ error: 'No programs with submitted rankings for this cycle and track' });
    }

    const matchRun = await MatchRun.create({
      cycle: cycleId,
      track,
      runType: 'dry_run',
      executedBy: req.user._id,
      inputsSnapshot: {
        applicantCount: applicantsInput.length,
        programCount: programsInput.length,
        totalCapacity: programsInput.reduce((sum, p) => sum + p.capacity, 0),
      },
    });

    const result = runGaleShapley({
      applicants: applicantsInput,
      programs: programsInput,
    });

    matchRun.status = 'completed';
    matchRun.results = {
      totalMatched: result.totalMatched,
      totalUnmatched: result.unmatchedApplicants.length,
      matches: result.matches.map((m) => ({ applicantId: m.applicantId, programId: m.programId })),
      unmatchedApplicants: result.unmatchedApplicants,
      programFillRates: result.programFillRates,
      iterations: result.iterations,
    };
    await matchRun.save();

    res.json({
      message: 'Dry run completed',
      matchRunId: matchRun._id,
      summary: {
        totalApplicants: result.totalApplicants,
        totalPrograms: result.totalPrograms,
        totalMatched: result.totalMatched,
        totalUnmatched: result.unmatchedApplicants.length,
        iterations: result.iterations,
      },
      results: result,
    });
  } catch (error) {
    console.error('Dry run error:', error);
    res.status(500).json({ error: error.message });
  }
};

exports.executeMatch = async (req, res) => {
  try {
    const { cycleId, track } = req.body;

    const cycle = await Cycle.findById(cycleId);
    if (!cycle) return res.status(404).json({ error: 'Cycle not found' });
    if (cycle.status === 'published' || cycle.status === 'closed') {
      return res.status(400).json({ error: 'Cycle is already published or closed' });
    }

    const existingOfficial = await MatchRun.findOne({
      cycle: cycleId,
      track,
      runType: 'official',
      status: 'completed',
    });
    if (existingOfficial) {
      return res.status(400).json({ error: 'An official match run already exists for this cycle and track' });
    }

    const { applicantsInput, programsInput, submittedApplications, programs } = await gatherInputs(cycleId, track);

    if (applicantsInput.length === 0) {
      return res.status(400).json({ error: 'No submitted applications for this cycle and track' });
    }
    if (programsInput.length === 0) {
      return res.status(400).json({ error: 'No programs with submitted rankings for this cycle and track' });
    }

    const programUniMap = new Map(
      programs.map((p) => [p._id.toString(), p.university.toString()])
    );

    const matchRun = await MatchRun.create({
      cycle: cycleId,
      track,
      runType: 'official',
      executedBy: req.user._id,
      inputsSnapshot: {
        applicantCount: applicantsInput.length,
        programCount: programsInput.length,
        totalCapacity: programsInput.reduce((sum, p) => sum + p.capacity, 0),
      },
    });

    const result = runGaleShapley({
      applicants: applicantsInput,
      programs: programsInput,
    });

    const applicantToProgramMap = new Map();
    for (const m of result.matches) {
      applicantToProgramMap.set(m.applicantId, m.programId);
    }

    for (const app of submittedApplications) {
      const matched = applicantToProgramMap.get(app.applicant._id.toString());
      if (matched) {
        app.status = 'matched';
        app.matchedProgram = matched;
        app.offerStatus = 'pending';
        app.offerExpiresAt = new Date(Date.now() + cycle.acceptanceWindowHours * 60 * 60 * 1000);
        const matchedUniId = programUniMap.get(matched);
        if (matchedUniId) {
          await ApplicationReviewState.findOneAndUpdate(
            { application: app._id, university: matchedUniId },
            { state: 'matched' },
            { upsert: true, new: true, setDefaultsOnInsert: true }
          );
        }
      } else {
        app.status = 'unmatched';
      }
      await app.save();
    }

    for (const fillRate of result.programFillRates) {
      await Program.findByIdAndUpdate(fillRate.programId, {
        availableSeats: fillRate.unfilled,
      });
    }

    cycle.status = 'matching';
    await cycle.save();

    matchRun.status = 'completed';
    matchRun.results = {
      totalMatched: result.totalMatched,
      totalUnmatched: result.unmatchedApplicants.length,
      matches: result.matches.map((m) => ({ applicantId: m.applicantId, programId: m.programId })),
      unmatchedApplicants: result.unmatchedApplicants,
      programFillRates: result.programFillRates,
      iterations: result.iterations,
    };
    await matchRun.save();

    await logAction({
      actor: req.user._id,
      actorRole: req.user.role,
      action: 'MATCH_RUN_EXECUTED',
      targetType: 'MatchRun',
      targetId: matchRun._id,
      metadata: {
        cycleId,
        track,
        totalMatched: result.totalMatched,
        totalUnmatched: result.unmatchedApplicants.length,
      },
      ipAddress: req.ip,
    });

    res.json({
      message: 'Official match run completed',
      matchRunId: matchRun._id,
      summary: {
        totalApplicants: result.totalApplicants,
        totalMatched: result.totalMatched,
        totalUnmatched: result.unmatchedApplicants.length,
        iterations: result.iterations,
      },
    });
  } catch (error) {
    console.error('Execute match error:', error);
    res.status(500).json({ error: error.message });
  }
};

exports.getMatchRuns = async (req, res) => {
  const runs = await MatchRun.find()
    .populate('cycle', 'name year')
    .populate('executedBy', 'firstName lastName email')
    .sort('-createdAt');
  res.json(runs);
};

exports.getMatchRun = async (req, res) => {
  const run = await MatchRun.findById(req.params.id)
    .populate('cycle', 'name year')
    .populate('executedBy', 'firstName lastName email')
    .populate('results.matches.applicantId', 'firstName lastName email')
    .populate('results.matches.programId');
  if (!run) return res.status(404).json({ error: 'Match run not found' });
  res.json(run);
};

exports.publishResults = async (req, res) => {
  try {
    const { cycleId, track } = req.body;

    const cycle = await Cycle.findById(cycleId);
    if (!cycle) return res.status(404).json({ error: 'Cycle not found' });
    if (cycle.status !== 'matching') {
      return res.status(400).json({ error: `Cycle is in ${cycle.status} state, cannot publish` });
    }

    const officialRun = await MatchRun.findOne({
      cycle: cycleId,
      track,
      runType: 'official',
      status: 'completed',
    });
    if (!officialRun) {
      return res.status(400).json({ error: 'No completed official match run found for this cycle and track' });
    }

    cycle.status = 'published';
    await cycle.save();

    await logAction({
      actor: req.user._id,
      actorRole: req.user.role,
      action: 'RESULTS_PUBLISHED',
      targetType: 'Cycle',
      targetId: cycle._id,
      metadata: { track, matchRunId: officialRun._id },
      ipAddress: req.ip,
    });

    const allRelevantApps = await Application.find({
      cycle: cycleId,
      track,
      status: { $in: ['matched', 'unmatched'] },
    });

    const notifications = allRelevantApps.map((app) => ({
      user: app.applicant,
      type: 'match_published',
      title: 'Match results published',
      message:
        app.status === 'matched'
          ? 'Your residency match results are now available. Log in to view and accept your offer.'
          : 'The match results have been published. View your application for details.',
      link: `/applicant/applications/${app._id}`,
      metadata: { applicationId: app._id, status: app.status },
    }));

    if (notifications.length > 0) {
      await Notification.insertMany(notifications).catch((err) =>
        console.error('Bulk notification error:', err.message)
      );
    }

    const matchedAppsForEmail = await Application.find({
      cycle: cycleId,
      track,
      status: 'matched',
    })
      .populate('applicant', 'firstName lastName email')
      .populate({
        path: 'matchedProgram',
        populate: [
          { path: 'university', select: 'name' },
          { path: 'specialty', select: 'name' },
        ],
      });

    const unmatchedAppsForEmail = await Application.find({
      cycle: cycleId,
      track,
      status: 'unmatched',
    }).populate('applicant', 'firstName lastName email');

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

    for (const app of matchedAppsForEmail) {
      if (!app.applicant?.email) continue;
      const programName = app.matchedProgram?.specialty?.name || 'your matched program';
      const universityName = app.matchedProgram?.university?.name || '';
      sendEmail({
        to: app.applicant.email,
        subject: 'LRFAP — Your match results are published',
        html: matchPublishedTemplate({
          firstName: app.applicant.firstName,
          programName,
          universityName,
          applicationLink: `${frontendUrl}/applicant/applications/${app._id}`,
        }),
      }).catch((err) => console.error('Email send failed:', err.message));
    }

    for (const app of unmatchedAppsForEmail) {
      if (!app.applicant?.email) continue;
      sendEmail({
        to: app.applicant.email,
        subject: 'LRFAP — Match results are published',
        html: matchUnmatchedTemplate({
          firstName: app.applicant.firstName,
          applicationLink: `${frontendUrl}/applicant/applications/${app._id}`,
        }),
      }).catch((err) => console.error('Email send failed:', err.message));
    }

    res.json({
      message: 'Results published successfully',
      cycle,
      matchRunId: officialRun._id,
    });
  } catch (error) {
    console.error('Publish results error:', error);
    res.status(500).json({ error: error.message });
  }
};