const mongoose = require('mongoose');
const User = require('../models/User');
const Application = require('../models/Application');
const Program = require('../models/Program');
const University = require('../models/University');
const Specialty = require('../models/Specialty');
const Cycle = require('../models/Cycle');
const ApplicantProfile = require('../models/ApplicantProfile');
const AuditLog = require('../models/AuditLog');
const ProgramRanking = require('../models/ProgramRanking');
const ApplicationReviewState = require('../models/ApplicationReviewState');

exports.getLGCDashboard = async (req, res) => {
  try {
    const [
      totalApplicants,
      totalUniversities,
      totalSpecialties,
      totalPrograms,
      totalApplications,
      submittedApplications,
      matchedApplications,
      unmatchedApplications,
      submittedRankings,
      activeCycle,
      recentActivity,
    ] = await Promise.all([
      User.countDocuments({ role: 'applicant', isActive: true }),
      University.countDocuments({ isActive: true }),
      Specialty.countDocuments({ isActive: true }),
      Program.countDocuments({ isActive: true }),
      Application.countDocuments(),
      Application.countDocuments({ status: 'submitted' }),
      Application.countDocuments({ status: 'matched' }),
      Application.countDocuments({ status: 'unmatched' }),
      ProgramRanking.countDocuments({ status: 'submitted' }),
      Cycle.findOne({ status: { $in: ['open', 'review', 'ranking', 'matching', 'published'] } }).sort('-year'),
      AuditLog.find().populate('actor', 'firstName lastName email role').sort('-createdAt').limit(10),
    ]);

    const programs = await Program.find({ isActive: true });
    const totalCapacity = programs.reduce((sum, p) => sum + p.capacity, 0);
    const totalAvailableSeats = programs.reduce((sum, p) => sum + p.availableSeats, 0);
    const filledSeats = totalCapacity - totalAvailableSeats;
    const fillRate = totalCapacity > 0 ? Math.round((filledSeats / totalCapacity) * 100) : 0;

    const applicationsBySpecialty = await Application.aggregate([
      { $match: { status: { $in: ['submitted', 'matched', 'unmatched'] } } },
      { $unwind: '$selections' },
      { $group: { _id: '$selections.program', count: { $sum: 1 } } },
      { $lookup: { from: 'programs', localField: '_id', foreignField: '_id', as: 'program' } },
      { $unwind: '$program' },
      { $group: { _id: '$program.specialty', count: { $sum: '$count' } } },
      { $lookup: { from: 'specialties', localField: '_id', foreignField: '_id', as: 'specialty' } },
      { $unwind: '$specialty' },
      { $project: { specialty: '$specialty.name', code: '$specialty.code', count: 1, _id: 0 } },
      { $sort: { count: -1 } },
    ]);

    res.json({
      counts: {
        applicants: totalApplicants,
        universities: totalUniversities,
        specialties: totalSpecialties,
        programs: totalPrograms,
        applications: {
          total: totalApplications,
          submitted: submittedApplications,
          matched: matchedApplications,
          unmatched: unmatchedApplications,
        },
        rankingsSubmitted: submittedRankings,
      },
      capacity: {
        totalCapacity,
        filledSeats,
        availableSeats: totalAvailableSeats,
        fillRate,
      },
      activeCycle: activeCycle
        ? {
            id: activeCycle._id,
            name: activeCycle.name,
            year: activeCycle.year,
            status: activeCycle.status,
            submissionDeadline: activeCycle.submissionDeadline,
            rankingDeadline: activeCycle.rankingDeadline,
            resultPublicationDate: activeCycle.resultPublicationDate,
          }
        : null,
      applicationsBySpecialty,
      recentActivity: recentActivity.map((log) => ({
        id: log._id,
        action: log.action,
        actor: log.actor ? `${log.actor.firstName} ${log.actor.lastName}` : 'Unknown',
        actorRole: log.actorRole,
        targetType: log.targetType,
        outcome: log.outcome,
        createdAt: log.createdAt,
      })),
    });
  } catch (error) {
    console.error('LGC dashboard error:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * GET /api/dashboard/lgc/ranking-summary?cycle=<id>
 *
 * Collapses the frontend's old N+1 (one ranking fetch per program) into
 * a single aggregation. Returns per-university ranking completion stats
 * scoped to one cycle, plus rollups by track and overall totals.
 *
 * Deliberately does NOT auto-create missing ProgramRanking docs — the
 * aggregation infers 'draft' for programs with no ranking document, so
 * the list endpoint becomes side-effect-free (unlike the per-program
 * getProgramRanking controller which creates drafts on read).
 *
 * Universities with zero programs in this cycle are omitted; the
 * frontend merges them in from its own universities list.
 */
exports.getLGCRankingSummary = async (req, res) => {
  try {
    const cycleParam = req.query.cycle;
    if (!cycleParam) {
      return res.status(400).json({ error: 'cycle parameter is required' });
    }
    if (!mongoose.Types.ObjectId.isValid(cycleParam)) {
      return res.status(400).json({ error: 'Invalid cycle ID' });
    }
    const cycleId = new mongoose.Types.ObjectId(cycleParam);

    const cycle = await Cycle.findById(cycleId).select('_id');
    if (!cycle) {
      return res.status(404).json({ error: 'Cycle not found' });
    }

    // Pre-query: which programs in this cycle have ≥ 1 submitted
    // applicant? Matching uses only status='submitted' applications
    // (see matchController.gatherInputs), so the readiness denominator
    // should mirror that filter. Programs without applicants can't
    // match anyone even if unranked — the frontend uses this set to
    // show "X of Y programs-with-applicants ranked" instead of gating
    // on every program in the cycle.
    const appPrograms = await Application.aggregate([
      { $match: { cycle: cycleId, status: 'submitted' } },
      { $unwind: '$selections' },
      { $group: { _id: '$selections.program' } },
    ]);
    const programsWithApplicantsIds = appPrograms.map((r) => r._id);

    const [facet] = await Program.aggregate([
      { $match: { cycle: cycleId, isActive: true } },
      {
        $lookup: {
          from: 'programrankings',
          let: { programId: '$_id' },
          pipeline: [
            {
              $match: {
                cycle: cycleId,
                $expr: { $eq: ['$program', '$$programId'] },
              },
            },
            { $project: { status: 1, updatedAt: 1 } },
          ],
          as: 'ranking',
        },
      },
      {
        $addFields: {
          rankingStatus: {
            $ifNull: [{ $arrayElemAt: ['$ranking.status', 0] }, 'draft'],
          },
          hasApplicants: {
            $in: ['$_id', programsWithApplicantsIds],
          },
        },
      },
      {
        $facet: {
          perUniversity: [
            {
              $group: {
                _id: '$university',
                totalPrograms: { $sum: 1 },
                submittedRankings: {
                  $sum: {
                    $cond: [{ $eq: ['$rankingStatus', 'submitted'] }, 1, 0],
                  },
                },
                residencyTotal: {
                  $sum: { $cond: [{ $eq: ['$track', 'residency'] }, 1, 0] },
                },
                residencySubmitted: {
                  $sum: {
                    $cond: [
                      {
                        $and: [
                          { $eq: ['$track', 'residency'] },
                          { $eq: ['$rankingStatus', 'submitted'] },
                        ],
                      },
                      1,
                      0,
                    ],
                  },
                },
                fellowshipTotal: {
                  $sum: { $cond: [{ $eq: ['$track', 'fellowship'] }, 1, 0] },
                },
                fellowshipSubmitted: {
                  $sum: {
                    $cond: [
                      {
                        $and: [
                          { $eq: ['$track', 'fellowship'] },
                          { $eq: ['$rankingStatus', 'submitted'] },
                        ],
                      },
                      1,
                      0,
                    ],
                  },
                },
                lastUpdatedAt: { $max: '$updatedAt' },
              },
            },
            {
              $lookup: {
                from: 'universities',
                localField: '_id',
                foreignField: '_id',
                as: 'uni',
              },
            },
            { $unwind: '$uni' },
            {
              $project: {
                _id: 1,
                name: '$uni.name',
                code: '$uni.code',
                totalPrograms: 1,
                submittedRankings: 1,
                tracks: {
                  residency: {
                    totalPrograms: '$residencyTotal',
                    submittedRankings: '$residencySubmitted',
                  },
                  fellowship: {
                    totalPrograms: '$fellowshipTotal',
                    submittedRankings: '$fellowshipSubmitted',
                  },
                },
                lastUpdatedAt: 1,
              },
            },
            { $sort: { name: 1 } },
          ],
          totals: [
            {
              $group: {
                _id: null,
                programs: { $sum: 1 },
                submittedRankings: {
                  $sum: {
                    $cond: [{ $eq: ['$rankingStatus', 'submitted'] }, 1, 0],
                  },
                },
                residencyTotal: {
                  $sum: { $cond: [{ $eq: ['$track', 'residency'] }, 1, 0] },
                },
                residencySubmitted: {
                  $sum: {
                    $cond: [
                      {
                        $and: [
                          { $eq: ['$track', 'residency'] },
                          { $eq: ['$rankingStatus', 'submitted'] },
                        ],
                      },
                      1,
                      0,
                    ],
                  },
                },
                residencyWithApplicants: {
                  $sum: {
                    $cond: [
                      {
                        $and: [
                          { $eq: ['$track', 'residency'] },
                          '$hasApplicants',
                        ],
                      },
                      1,
                      0,
                    ],
                  },
                },
                residencyWithApplicantsAndSubmitted: {
                  $sum: {
                    $cond: [
                      {
                        $and: [
                          { $eq: ['$track', 'residency'] },
                          '$hasApplicants',
                          { $eq: ['$rankingStatus', 'submitted'] },
                        ],
                      },
                      1,
                      0,
                    ],
                  },
                },
                fellowshipTotal: {
                  $sum: { $cond: [{ $eq: ['$track', 'fellowship'] }, 1, 0] },
                },
                fellowshipSubmitted: {
                  $sum: {
                    $cond: [
                      {
                        $and: [
                          { $eq: ['$track', 'fellowship'] },
                          { $eq: ['$rankingStatus', 'submitted'] },
                        ],
                      },
                      1,
                      0,
                    ],
                  },
                },
                fellowshipWithApplicants: {
                  $sum: {
                    $cond: [
                      {
                        $and: [
                          { $eq: ['$track', 'fellowship'] },
                          '$hasApplicants',
                        ],
                      },
                      1,
                      0,
                    ],
                  },
                },
                fellowshipWithApplicantsAndSubmitted: {
                  $sum: {
                    $cond: [
                      {
                        $and: [
                          { $eq: ['$track', 'fellowship'] },
                          '$hasApplicants',
                          { $eq: ['$rankingStatus', 'submitted'] },
                        ],
                      },
                      1,
                      0,
                    ],
                  },
                },
              },
            },
          ],
        },
      },
    ]);

    const totals = facet?.totals?.[0] || {
      programs: 0,
      submittedRankings: 0,
      residencyTotal: 0,
      residencySubmitted: 0,
      residencyWithApplicants: 0,
      residencyWithApplicantsAndSubmitted: 0,
      fellowshipTotal: 0,
      fellowshipSubmitted: 0,
      fellowshipWithApplicants: 0,
      fellowshipWithApplicantsAndSubmitted: 0,
    };

    res.json({
      cycleId: cycleId.toString(),
      totals: {
        programs: totals.programs,
        submittedRankings: totals.submittedRankings,
        draftRankings: totals.programs - totals.submittedRankings,
      },
      tracks: {
        residency: {
          totalPrograms: totals.residencyTotal,
          submittedRankings: totals.residencySubmitted,
          programsWithApplicants: totals.residencyWithApplicants,
          programsWithApplicantsAndSubmittedRanking:
            totals.residencyWithApplicantsAndSubmitted,
        },
        fellowship: {
          totalPrograms: totals.fellowshipTotal,
          submittedRankings: totals.fellowshipSubmitted,
          programsWithApplicants: totals.fellowshipWithApplicants,
          programsWithApplicantsAndSubmittedRanking:
            totals.fellowshipWithApplicantsAndSubmitted,
        },
      },
      universities: facet?.perUniversity ?? [],
    });
  } catch (error) {
    console.error('LGC ranking summary error:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * GET /api/dashboard/university/program-counts?cycle=<id>
 *
 * Per-program applicant status counts for the authenticated university's
 * programs in a given cycle, plus total unique applicants across all of
 * those programs. Replaces the old per-program application fetch loop on
 * the University dashboard.
 *
 * Draft applications are excluded to match the rest of the university
 * portal (reviewers never see drafts).
 */
exports.getUniversityProgramCounts = async (req, res) => {
  try {
    const cycleParam = req.query.cycle;
    if (!cycleParam) {
      return res.status(400).json({ error: 'cycle parameter is required' });
    }
    if (!mongoose.Types.ObjectId.isValid(cycleParam)) {
      return res.status(400).json({ error: 'Invalid cycle ID' });
    }
    const cycleId = new mongoose.Types.ObjectId(cycleParam);

    const cycle = await Cycle.findById(cycleId).select('_id');
    if (!cycle) {
      return res.status(404).json({ error: 'Cycle not found' });
    }

    const universityId = req.user.university;
    if (!universityId) {
      return res
        .status(400)
        .json({ error: 'Authenticated user is not associated with a university' });
    }

    const programIds = await Program.find({
      university: universityId,
      cycle: cycleId,
      isActive: true,
    }).distinct('_id');

    if (programIds.length === 0) {
      return res.json({
        universityId: universityId.toString(),
        cycleId: cycleId.toString(),
        totalUniqueApplicants: 0,
        pendingReview: 0,
        programs: [],
      });
    }

    const VISIBLE_STATUSES = [
      'submitted',
      'under_review',
      'matched',
      'unmatched',
      'withdrawn',
    ];

    // pendingReview is the per-university review-workflow inbox.
    // ApplicationReviewState rows are only created when a reviewer first
    // hits "Begin Review" / "Mark Reviewed" (lazy upsert) — fresh
    // submissions have no row yet but the per-program detail UI
    // defaults a missing row to state='new'. We mirror that here:
    //   pending = (reviewable cycle apps) − (rows in 'reviewed' or 'matched')
    // i.e. missing-row + 'new' + 'under_review' all count as pending.
    const [aggResults, pendingReview] = await Promise.all([
      Application.aggregate([
        {
          $match: {
            cycle: cycleId,
            'selections.program': { $in: programIds },
            status: { $in: VISIBLE_STATUSES },
          },
        },
        { $unwind: '$selections' },
        { $match: { 'selections.program': { $in: programIds } } },
        {
          $facet: {
            perProgram: [
              {
                $group: {
                  _id: { program: '$selections.program', status: '$status' },
                  count: { $sum: 1 },
                },
              },
              {
                $group: {
                  _id: '$_id.program',
                  statuses: {
                    $push: { status: '$_id.status', count: '$count' },
                  },
                },
              },
            ],
            uniqueApplicants: [
              { $group: { _id: '$applicant' } },
              { $count: 'total' },
            ],
          },
        },
      ]),
      (async () => {
        const cycleAppIds = await Application.find({
          cycle: cycleId,
          'selections.program': { $in: programIds },
          status: { $in: ['submitted', 'under_review', 'matched', 'unmatched'] },
        }).distinct('_id');
        if (cycleAppIds.length === 0) return 0;
        const completed = await ApplicationReviewState.countDocuments({
          university: universityId,
          application: { $in: cycleAppIds },
          state: { $in: ['reviewed', 'matched'] },
        });
        return cycleAppIds.length - completed;
      })(),
    ]);
    const facet = aggResults[0];

    const emptyCounts = () => ({
      submitted: 0,
      under_review: 0,
      matched: 0,
      unmatched: 0,
      withdrawn: 0,
      total: 0,
    });

    const countsByProgram = new Map();
    for (const row of facet?.perProgram ?? []) {
      const counts = emptyCounts();
      for (const entry of row.statuses) {
        if (counts[entry.status] !== undefined) {
          counts[entry.status] = entry.count;
          counts.total += entry.count;
        }
      }
      countsByProgram.set(row._id.toString(), counts);
    }

    const programs = programIds.map((id) => ({
      programId: id.toString(),
      counts: countsByProgram.get(id.toString()) ?? emptyCounts(),
    }));

    res.json({
      universityId: universityId.toString(),
      cycleId: cycleId.toString(),
      totalUniqueApplicants: facet?.uniqueApplicants?.[0]?.total ?? 0,
      pendingReview,
      programs,
    });
  } catch (error) {
    console.error('University program counts error:', error);
    res.status(500).json({ error: error.message });
  }
};

exports.getApplicantDashboard = async (req, res) => {
  try {
    const [profile, applications, activeCycle] = await Promise.all([
      ApplicantProfile.findOne({ user: req.user._id }),
      Application.find({ applicant: req.user._id })
        .populate('cycle', 'name year status submissionDeadline rankingDeadline resultPublicationDate')
        .populate('matchedProgram'),
      Cycle.findOne({ status: { $in: ['open', 'review', 'ranking', 'matching', 'published'] } }).sort('-year'),
    ]);

    const profileFields = ['dateOfBirth', 'gender', 'nationality', 'phone', 'medicalSchool', 'graduationYear'];
    let completedFields = 0;
    if (profile) {
      for (const f of profileFields) {
        if (profile[f] !== undefined && profile[f] !== null && profile[f] !== '') completedFields++;
      }
    }
    const profileCompletion = Math.round((completedFields / profileFields.length) * 100);

    const checklist = {
      profileCompleted: profile?.profileCompleted || false,
      hasDraft: applications.some((a) => a.status === 'draft'),
      hasSubmitted: applications.some((a) => a.status === 'submitted' || a.status === 'matched' || a.status === 'unmatched'),
      hasMatch: applications.some((a) => a.status === 'matched'),
      hasPendingOffer: applications.some((a) => a.offerStatus === 'pending'),
    };

    res.json({
      user: {
        id: req.user._id,
        firstName: req.user.firstName,
        lastName: req.user.lastName,
        email: req.user.email,
      },
      profileCompletion,
      checklist,
      applications: applications.map((a) => ({
        id: a._id,
        cycle: a.cycle,
        track: a.track,
        status: a.status,
        submissionReference: a.submissionReference,
        submittedAt: a.submittedAt,
        matchedProgram: a.matchedProgram,
        offerStatus: a.offerStatus,
        offerExpiresAt: a.offerExpiresAt,
      })),
      activeCycle: activeCycle
        ? {
            id: activeCycle._id,
            name: activeCycle.name,
            year: activeCycle.year,
            status: activeCycle.status,
            submissionDeadline: activeCycle.submissionDeadline,
            rankingDeadline: activeCycle.rankingDeadline,
            resultPublicationDate: activeCycle.resultPublicationDate,
          }
        : null,
    });
  } catch (error) {
    console.error('Applicant dashboard error:', error);
    res.status(500).json({ error: error.message });
  }
};