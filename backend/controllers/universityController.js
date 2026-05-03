const University = require('../models/University');

exports.createUniversity = async (req, res) => {
  try {
    const university = await University.create(req.body);
    res.status(201).json(university);
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ error: 'University name or code already exists' });
    res.status(400).json({ error: error.message });
  }
};

exports.getUniversities = async (req, res) => {
  const universities = await University.find({ isActive: true }).sort('name');
  res.json(universities);
};

exports.getUniversity = async (req, res) => {
  const university = await University.findById(req.params.id);
  if (!university) return res.status(404).json({ error: 'University not found' });
  res.json(university);
};

exports.updateUniversity = async (req, res) => {
  try {
    const university = await University.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!university) return res.status(404).json({ error: 'University not found' });
    res.json(university);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

exports.deleteUniversity = async (req, res) => {
  const university = await University.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true });
  if (!university) return res.status(404).json({ error: 'University not found' });
  res.json({ message: 'University deactivated' });
};