const Specialty = require('../models/Specialty');

exports.createSpecialty = async (req, res) => {
  try {
    const specialty = await Specialty.create(req.body);
    res.status(201).json(specialty);
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ error: 'Specialty name or code already exists' });
    res.status(400).json({ error: error.message });
  }
};

exports.getSpecialties = async (req, res) => {
  const specialties = await Specialty.find({ isActive: true }).sort('name');
  res.json(specialties);
};

exports.getSpecialty = async (req, res) => {
  const specialty = await Specialty.findById(req.params.id);
  if (!specialty) return res.status(404).json({ error: 'Specialty not found' });
  res.json(specialty);
};

exports.updateSpecialty = async (req, res) => {
  try {
    const specialty = await Specialty.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!specialty) return res.status(404).json({ error: 'Specialty not found' });
    res.json(specialty);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

exports.deleteSpecialty = async (req, res) => {
  const specialty = await Specialty.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true });
  if (!specialty) return res.status(404).json({ error: 'Specialty not found' });
  res.json({ message: 'Specialty deactivated' });
};