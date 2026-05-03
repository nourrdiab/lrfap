const Cycle = require('../models/Cycle');

exports.createCycle = async (req, res) => {
  try {
    const cycle = await Cycle.create(req.body);
    res.status(201).json(cycle);
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ error: 'Cycle name already exists' });
    res.status(400).json({ error: error.message });
  }
};

exports.getCycles = async (req, res) => {
  const cycles = await Cycle.find().sort('-year');
  res.json(cycles);
};

exports.getCycle = async (req, res) => {
  const cycle = await Cycle.findById(req.params.id);
  if (!cycle) return res.status(404).json({ error: 'Cycle not found' });
  res.json(cycle);
};

exports.updateCycle = async (req, res) => {
  try {
    const cycle = await Cycle.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!cycle) return res.status(404).json({ error: 'Cycle not found' });
    res.json(cycle);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

exports.updateCycleStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const cycle = await Cycle.findByIdAndUpdate(req.params.id, { status }, { new: true, runValidators: true });
    if (!cycle) return res.status(404).json({ error: 'Cycle not found' });
    res.json(cycle);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};