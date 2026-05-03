const Program = require('../models/Program');

exports.createProgram = async (req, res) => {
  try {
    if (req.user.role === 'university') {
      if (!req.user.university) {
        return res.status(403).json({ error: 'Forbidden: account is not linked to a university' });
      }
      if (req.body.university && req.body.university.toString() !== req.user.university.toString()) {
        return res.status(403).json({ error: 'Forbidden: cannot create programs for a different university' });
      }
      req.body.university = req.user.university;
    }
    if (req.body.availableSeats === undefined) req.body.availableSeats = req.body.capacity;
    const program = await Program.create(req.body);
    res.status(201).json(program);
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ error: 'A program for this university, specialty, cycle and track already exists' });
    res.status(400).json({ error: error.message });
  }
};

exports.getPrograms = async (req, res) => {
  const { cycle, university, specialty, track } = req.query;
  const filter = { isActive: true };
  if (cycle) filter.cycle = cycle;
  if (university) filter.university = university;
  if (specialty) filter.specialty = specialty;
  if (track) filter.track = track;

  const programs = await Program.find(filter)
    .populate('university', 'name code city')
    .populate('specialty', 'name code')
    .populate('cycle', 'name year status');
  res.json(programs);
};

exports.getProgram = async (req, res) => {
  const program = await Program.findById(req.params.id)
    .populate('university', 'name code city')
    .populate('specialty', 'name code')
    .populate('cycle', 'name year status');
  if (!program) return res.status(404).json({ error: 'Program not found' });
  res.json(program);
};

exports.updateProgram = async (req, res) => {
  try {
    if (req.user.role === 'university') {
      if (!req.user.university) {
        return res.status(403).json({ error: 'Forbidden: account is not linked to a university' });
      }
      const existing = await Program.findById(req.params.id).select('university');
      if (!existing) return res.status(404).json({ error: 'Program not found' });
      if (existing.university.toString() !== req.user.university.toString()) {
        return res.status(403).json({ error: 'Forbidden: program does not belong to your institution' });
      }
      if (req.body.university && req.body.university.toString() !== req.user.university.toString()) {
        return res.status(403).json({ error: 'Forbidden: cannot reassign program to a different university' });
      }
    }
    const program = await Program.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!program) return res.status(404).json({ error: 'Program not found' });
    res.json(program);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

exports.deleteProgram = async (req, res) => {
  const program = await Program.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true });
  if (!program) return res.status(404).json({ error: 'Program not found' });
  res.json({ message: 'Program deactivated' });
};