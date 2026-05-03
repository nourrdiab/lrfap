const Application = require('../models/Application');
const ApplicantProfile = require('../models/ApplicantProfile');
const Program = require('../models/Program');
const ProgramRanking = require('../models/ProgramRanking');
const ApplicationReviewState = require('../models/ApplicationReviewState');
const Cycle = require('../models/Cycle');
const { logAction } = require('../utils/audit');
const { notify } = require('../utils/notify');

const ensureProgramBelongsToUser = async (programId, user) => {
  const program = await Program.findById(programId);
  if (!program) return { error: 'Program not found', status: 404 };
  if (user.role !== 'lgc' && program.university.toString() !== (user.university || '').toString()) {
    return { error: 'Forbidden: program does not belong to your institution', status: 403 };
  }
  return { program };
};

const ensureApplicationBelongsToUniversity = async (applicationId, user) => {
  const application = await Application.findById(applicationId).populate({
    path: 'selections.program',
    select: 'university',
  });
  if (!application) return { error: 'Application not found', status: 404 };
  if (user.role === 'lgc') return { application };
  if (!user.university) return { error: 'Forbidden', status: 403 };
  const myUniId = user.university.toString();
  const belongs = application.selections.some(
    (s) => s.program?.university?.toString() === myUniId
  );
  if (!belongs) return { error: 'Forbidden', status: 403 };
  return { application };
};

// Strip preference-revealing data from an application before returning it
// to a university reviewer: keep only selections whose program belongs to
// the reviewer's university, and remove the applicant's rank for each.
// The matching algorithm is stable only if neither side knows the other's
// rankings; the reviewer learns nothing here that they didn't know already
// (they can already see that the applicant chose at least one of their
// programs — that's why this application is in their review queue).
const sanitizeForUniversityReview = (application, viewerUniversityId) => {
  const obj = application.toObject ? application.toObject() : { ...application };
  if (Array.isArray(obj.selections)) {
    const myUniId = viewerUniversityId.toString();
    obj.selections = obj.selections
      .filter((s) => {
        const programUni = s.program?.university?._id || s.program?.university;
        return programUni && programUni.toString() === myUniId;
      })
      .map((s) => {
        const { rank, ...rest } = s;
        return rest;
      });
  }
  return obj;
};

exports.getMyPrograms = async (req, res) => {
  try {
    const filter = { isActive: true };
    if (req.user.role === 'university') {
      filter.university = req.user.university;
    }
    const programs = await Program.find(filter)
      .populate('specialty', 'name code')
      .populate('cycle', 'name year status')
      .populate('university', 'name code');
    res.json(programs);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getProgramApplications = async (req, res) => {
  try {
    const { programId } = req.params;
    const check = await ensureProgramBelongsToUser(programId, req.user);
    if (check.error) return res.status(check.status).json({ error: check.error });

    const { status, search } = req.query;
    const filter = {
      'selections.program': programId,
      status: { $in: ['submitted', 'under_review', 'matched', 'unmatched'] },
    };
    if (status) filter.status = status;

    let applications = await Application.find(filter)
      .populate('applicant', 'firstName lastName email')
      .populate('cycle', 'name year')
      .populate({
        path: 'selections.program',
        select: 'track university',
      });

    if (search) {
      const term = search.toLowerCase();
      applications = applications.filter((app) => {
        const name = `${app.applicant.firstName} ${app.applicant.lastName}`.toLowerCase();
        return name.includes(term) || app.applicant.email.toLowerCase().includes(term);
      });
    }

    if (req.user.role === 'lgc') {
      return res.json(applications.map((app) => app.toObject()));
    }
    const appIds = applications.map((a) => a._id);
    const reviewStates = await ApplicationReviewState.find({
      application: { $in: appIds },
      university: req.user.university,
    });
    const stateByApp = new Map(
      reviewStates.map((r) => [r.application.toString(), r.state])
    );
    const sanitized = applications.map((app) => {
      const obj = sanitizeForUniversityReview(app, req.user.university);
      obj.reviewState = stateByApp.get(app._id.toString()) || 'new';
      return obj;
    });
    res.json(sanitized);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getApplicationDetail = async (req, res) => {
  try {
    const application = await Application.findById(req.params.applicationId)
      .populate('applicant', 'firstName lastName email')
      .populate('cycle')
      .populate({
        path: 'selections.program',
        populate: [
          { path: 'university', select: 'name code' },
          { path: 'specialty', select: 'name code' },
        ],
      });

    if (!application) return res.status(404).json({ error: 'Application not found' });

    // Reviewer-facing detail includes the applicant's profile so the
    // university committee can see medical school, languages, IFOM
    // scores, research, etc. without bouncing to a separate endpoint.
    const applicantProfile = await ApplicantProfile.findOne({
      user: application.applicant._id,
    }).populate('medicalSchool', 'name code');

    if (req.user.role === 'university') {
      if (!req.user.university) {
        return res.status(403).json({ error: 'Forbidden' });
      }
      const myUniversityId = req.user.university.toString();
      const belongsToUniversity = application.selections.some(
        (s) => s.program?.university?._id?.toString() === myUniversityId
      );
      if (!belongsToUniversity) {
        return res.status(403).json({ error: 'Forbidden' });
      }
      const obj = sanitizeForUniversityReview(application, req.user.university);
      const rs = await ApplicationReviewState.findOne({
        application: application._id,
        university: req.user.university,
      });
      obj.reviewState = rs?.state || 'new';
      obj.applicantProfile = applicantProfile;
      return res.json(obj);
    }

    const obj = application.toObject();
    obj.applicantProfile = applicantProfile;
    res.json(obj);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getProgramRanking = async (req, res) => {
  try {
    const { programId } = req.params;
    const check = await ensureProgramBelongsToUser(programId, req.user);
    if (check.error) return res.status(check.status).json({ error: check.error });

    const program = check.program;

    const ranking = await ProgramRanking.findOne({ program: programId, cycle: program.cycle })
      .populate('rankedApplicants.applicant', 'firstName lastName email')
      .populate('submittedBy', 'firstName lastName');

    if (ranking) {
      return res.json(ranking);
    }

    // No document yet — return a synthetic empty draft instead of
    // auto-creating a row on read. Creating on GET polluted the cycle
    // with drafts the moment a reviewer previewed a program, which
    // then blocked dev/demo bulk-submission flows. The synthetic shape
    // omits `_id` (frontend type has it as optional) and matches what
    // the DB row would look like on first PUT.
    return res.json({
      program: programId,
      cycle: program.cycle,
      rankedApplicants: [],
      status: 'draft',
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.updateProgramRanking = async (req, res) => {
  try {
    const { programId } = req.params;
    const check = await ensureProgramBelongsToUser(programId, req.user);
    if (check.error) return res.status(check.status).json({ error: check.error });

    const program = check.program;
    const { rankedApplicants } = req.body;

    if (!Array.isArray(rankedApplicants)) {
      return res.status(400).json({ error: 'rankedApplicants must be an array' });
    }

    let ranking = await ProgramRanking.findOne({ program: programId, cycle: program.cycle });
    if (!ranking) {
      ranking = new ProgramRanking({ program: programId, cycle: program.cycle });
    }

    if (ranking.status === 'submitted') {
      return res.status(400).json({ error: 'Ranking has already been submitted and is locked' });
    }

    const applicationIds = rankedApplicants.map((r) => r.application);
    const validApplications = await Application.find({
      _id: { $in: applicationIds },
      'selections.program': programId,
      status: { $in: ['submitted', 'under_review'] },
    });

    if (validApplications.length !== applicationIds.length) {
      return res.status(400).json({
        error: 'One or more applications are invalid or did not select this program',
      });
    }

    ranking.rankedApplicants = rankedApplicants;
    await ranking.save();

    const populated = await ProgramRanking.findById(ranking._id)
      .populate('rankedApplicants.applicant', 'firstName lastName email');

    res.json(populated);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

exports.submitProgramRanking = async (req, res) => {
  try {
    const { programId } = req.params;
    const check = await ensureProgramBelongsToUser(programId, req.user);
    if (check.error) return res.status(check.status).json({ error: check.error });

    const program = check.program;
    const cycle = await Cycle.findById(program.cycle);
    if (!cycle) return res.status(404).json({ error: 'Cycle not found' });
    if (new Date() > cycle.rankingDeadline) {
      return res.status(400).json({ error: 'Ranking deadline has passed' });
    }

    const ranking = await ProgramRanking.findOne({ program: programId, cycle: program.cycle });
    if (!ranking) return res.status(404).json({ error: 'Ranking not found' });
    if (ranking.status === 'submitted') {
      return res.status(400).json({ error: 'Ranking is already submitted' });
    }
    if (!ranking.rankedApplicants || ranking.rankedApplicants.length === 0) {
      return res.status(400).json({ error: 'Cannot submit an empty ranking' });
    }

    ranking.status = 'submitted';
    ranking.submittedAt = new Date();
    ranking.submittedBy = req.user._id;
    await ranking.save();

    await logAction({
      actor: req.user._id,
      actorRole: req.user.role,
      action: 'PROGRAM_RANKING_SUBMITTED',
      targetType: 'ProgramRanking',
      targetId: ranking._id,
      metadata: { programId, cycleId: program.cycle },
      ipAddress: req.ip,
    });

    await notify({
      user: req.user._id,
      type: 'ranking_submitted',
      title: 'Ranking submitted',
      message: 'Your program ranking has been submitted and locked.',
      link: `/university/programs/${programId}/ranking`,
      metadata: { programId, rankingId: ranking._id },
    });

    res.json({ message: 'Ranking submitted successfully', ranking });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

exports.beginReview = async (req, res) => {
  try {
    if (req.user.role !== 'university') {
      return res
        .status(403)
        .json({ error: 'Only university reviewers can transition review state' });
    }
    const check = await ensureApplicationBelongsToUniversity(
      req.params.applicationId,
      req.user
    );
    if (check.error) return res.status(check.status).json({ error: check.error });

    const reviewState = await ApplicationReviewState.findOneAndUpdate(
      { application: req.params.applicationId, university: req.user.university },
      { state: 'under_review', updatedBy: req.user._id },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    res.json({ state: reviewState.state, updatedAt: reviewState.updatedAt });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.markReviewed = async (req, res) => {
  try {
    if (req.user.role !== 'university') {
      return res
        .status(403)
        .json({ error: 'Only university reviewers can transition review state' });
    }
    const check = await ensureApplicationBelongsToUniversity(
      req.params.applicationId,
      req.user
    );
    if (check.error) return res.status(check.status).json({ error: check.error });

    const reviewState = await ApplicationReviewState.findOneAndUpdate(
      { application: req.params.applicationId, university: req.user.university },
      { state: 'reviewed', updatedBy: req.user._id },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    res.json({ state: reviewState.state, updatedAt: reviewState.updatedAt });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};