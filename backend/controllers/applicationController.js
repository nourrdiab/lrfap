const Application = require('../models/Application');
const Program = require('../models/Program');
const Cycle = require('../models/Cycle');
const ApplicantProfile = require('../models/ApplicantProfile');
const { logAction } = require('../utils/audit');
const { notify } = require('../utils/notify');
const { sendEmail, applicationSubmittedTemplate } = require('../utils/email');

const generateReference = (track, year) => {
  const prefix = track === 'residency' ? 'R' : 'F';
  const random = Math.floor(Math.random() * 9000 + 1000);
  return `LRFAP-${year}-${prefix}-${random}`;
};

exports.createApplication = async (req, res) => {
  try {
    const { cycleId, track } = req.body;

    const cycle = await Cycle.findById(cycleId);
    if (!cycle) return res.status(404).json({ error: 'Cycle not found' });
    if (cycle.status !== 'open') {
      return res.status(400).json({ error: 'Cycle is not open for applications' });
    }

    const existing = await Application.findOne({
      applicant: req.user._id,
      cycle: cycleId,
    });
    if (existing) {
      return res.status(409).json({
        error: `You already have a ${existing.track} application for this cycle. Applicants may only apply to one track per cycle.`,
      });
    }

    const application = await Application.create({
      applicant: req.user._id,
      cycle: cycleId,
      track,
      status: 'draft',
    });

    res.status(201).json(application);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

exports.getMyApplications = async (req, res) => {
  const applications = await Application.find({ applicant: req.user._id })
    .populate('cycle', 'name year status submissionDeadline')
    .populate('selections.program');
  res.json(applications);
};

exports.getApplication = async (req, res) => {
  const application = await Application.findById(req.params.id)
    .populate('cycle')
    .populate({
      path: 'selections.program',
      populate: [
        { path: 'university', select: 'name code city' },
        { path: 'specialty', select: 'name code' },
      ],
    })
    .populate('matchedProgram');

  if (!application) return res.status(404).json({ error: 'Application not found' });
  if (application.applicant.toString() !== req.user._id.toString()) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  res.json(application);
};

exports.updateSelections = async (req, res) => {
  try {
    const application = await Application.findById(req.params.id);
    if (!application) return res.status(404).json({ error: 'Application not found' });
    if (application.applicant.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    if (application.status !== 'draft') {
      return res.status(400).json({ error: 'Cannot modify a non-draft application' });
    }

    const { selections } = req.body;
    if (!Array.isArray(selections)) {
      return res.status(400).json({ error: 'Selections must be an array' });
    }

    const programIds = selections.map((s) => s.program);
    const programs = await Program.find({
      _id: { $in: programIds },
      cycle: application.cycle,
      track: application.track,
      isActive: true,
    });

    if (programs.length !== programIds.length) {
      return res.status(400).json({
        error: 'One or more programs are invalid or do not belong to this cycle and track',
      });
    }

    application.selections = selections;
    await application.save();

    const populated = await Application.findById(application._id).populate({
      path: 'selections.program',
      populate: [
        { path: 'university', select: 'name code' },
        { path: 'specialty', select: 'name code' },
      ],
    });

    res.json(populated);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

exports.submitApplication = async (req, res) => {
  try {
    const application = await Application.findById(req.params.id);
    if (!application) return res.status(404).json({ error: 'Application not found' });
    if (application.applicant.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    if (application.status !== 'draft') {
      return res.status(400).json({ error: 'Application is not in draft state' });
    }
    if (!application.selections || application.selections.length === 0) {
      return res.status(400).json({ error: 'At least one program selection is required' });
    }
    if (!req.body.declarationAccepted) {
      return res.status(400).json({ error: 'Declaration must be accepted to submit' });
    }

    const profile = await ApplicantProfile.findOne({ user: req.user._id });
    if (!profile || !profile.profileCompleted) {
      return res.status(400).json({ error: 'Applicant profile must be completed before submission' });
    }

    const cycle = await Cycle.findById(application.cycle);
    if (!cycle || cycle.status !== 'open') {
      return res.status(400).json({ error: 'Cycle is not open for submissions' });
    }
    if (new Date() > cycle.submissionDeadline) {
      return res.status(400).json({ error: 'Submission deadline has passed' });
    }

    application.status = 'submitted';
    application.submittedAt = new Date();
    application.declarationAccepted = true;
    application.submissionReference = generateReference(application.track, cycle.year);

    await application.save();

    await logAction({
      actor: req.user._id,
      actorRole: req.user.role,
      action: 'APPLICATION_SUBMITTED',
      targetType: 'Application',
      targetId: application._id,
      metadata: { submissionReference: application.submissionReference, track: application.track },
      ipAddress: req.ip,
    });

    await notify({
      user: req.user._id,
      type: 'application_submitted',
      title: 'Application submitted',
      message: `Your application has been received. Reference: ${application.submissionReference}`,
      link: `/applicant/applications/${application._id}`,
      metadata: { applicationId: application._id, submissionReference: application.submissionReference },
    });

    if (req.user.email) {
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
      sendEmail({
        to: req.user.email,
        subject: 'Your LRFAP application has been received',
        html: applicationSubmittedTemplate({
          firstName: req.user.firstName,
          submissionReference: application.submissionReference,
          applicationLink: `${frontendUrl}/applicant/applications/${application._id}`,
        }),
      }).catch((err) => console.error('Submission email failed:', err.message));
    }

    res.json({
      message: 'Application submitted successfully',
      submissionReference: application.submissionReference,
      application,
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

exports.withdrawApplication = async (req, res) => {
  try {
    const application = await Application.findById(req.params.id);
    if (!application) return res.status(404).json({ error: 'Application not found' });
    if (application.applicant.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    if (!['draft', 'submitted'].includes(application.status)) {
      return res.status(400).json({ error: 'Cannot withdraw an application in this state' });
    }
    application.status = 'withdrawn';
    await application.save();
    res.json({ message: 'Application withdrawn', application });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

exports.deleteApplication = async (req, res) => {
  try {
    const application = await Application.findById(req.params.id);
    if (!application) return res.status(404).json({ error: 'Application not found' });
    if (application.applicant.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    if (application.status !== 'draft') {
      return res.status(400).json({ error: 'Only drafts can be deleted' });
    }
    await application.deleteOne();
    res.json({ message: 'Application deleted' });
  } catch (error) {
    console.error('deleteApplication error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.acceptOffer = async (req, res) => {
  try {
    const application = await Application.findById(req.params.id);
    if (!application) return res.status(404).json({ error: 'Application not found' });
    if (application.applicant.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    if (application.status !== 'matched') {
      return res.status(400).json({ error: 'Application is not in a matched state' });
    }
    if (application.offerStatus !== 'pending') {
      return res.status(400).json({ error: `Offer is ${application.offerStatus}, cannot accept` });
    }
    if (application.offerExpiresAt && new Date() > application.offerExpiresAt) {
      application.offerStatus = 'expired';
      await application.save();
      return res.status(400).json({ error: 'Offer window has expired' });
    }

    application.offerStatus = 'accepted';
    await application.save();

    res.json({ message: 'Offer accepted', application });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

exports.declineOffer = async (req, res) => {
  try {
    const application = await Application.findById(req.params.id);
    if (!application) return res.status(404).json({ error: 'Application not found' });
    if (application.applicant.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    if (application.status !== 'matched') {
      return res.status(400).json({ error: 'Application is not in a matched state' });
    }
    if (application.offerStatus !== 'pending') {
      return res.status(400).json({ error: `Offer is ${application.offerStatus}, cannot decline` });
    }

    const matchedProgramId = application.matchedProgram;

    application.offerStatus = 'declined';
    application.status = 'unmatched';
    application.matchedProgram = null;
    await application.save();

    if (matchedProgramId) {
      await Program.findByIdAndUpdate(matchedProgramId, { $inc: { availableSeats: 1 } });
    }

    res.json({ message: 'Offer declined', application });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};