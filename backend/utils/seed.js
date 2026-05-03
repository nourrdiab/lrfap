require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/db');

const Specialty = require('../models/Specialty');
const University = require('../models/University');
const Cycle = require('../models/Cycle');
const Program = require('../models/Program');
const User = require('../models/User');

const universities = [
  { name: 'American University of Beirut', code: 'AUB', city: 'Beirut', website: 'https://www.aub.edu.lb' },
  { name: 'Lebanese American University', code: 'LAU', city: 'Beirut', website: 'https://www.lau.edu.lb' },
  { name: 'Lebanese University', code: 'LU', city: 'Beirut', website: 'https://www.ul.edu.lb' },
  { name: 'Saint Joseph University of Beirut', code: 'USJ', city: 'Beirut', website: 'https://www.usj.edu.lb' },
  { name: 'University of Balamand', code: 'UOB', city: 'Koura', website: 'https://www.balamand.edu.lb' },
  { name: 'Beirut Arab University', code: 'BAU', city: 'Beirut', website: 'https://www.bau.edu.lb' },
  { name: 'Holy Spirit University of Kaslik', code: 'USEK', city: 'Kaslik', website: 'https://www.usek.edu.lb' },
  { name: 'Saint George University of Beirut', code: 'SGUB', city: 'Beirut', website: 'https://www.sgub.edu.lb' },
];

const specialties = [
  { name: 'Internal Medicine', code: 'IM', nationalQuota: 80 },
  { name: 'General Surgery', code: 'GS', nationalQuota: 40 },
  { name: 'Pediatrics', code: 'PED', nationalQuota: 50 },
  { name: 'Obstetrics and Gynecology', code: 'OBGYN', nationalQuota: 40 },
  { name: 'Cardiology', code: 'CARD', nationalQuota: 20 },
  { name: 'Neurology', code: 'NEURO', nationalQuota: 20 },
  { name: 'Psychiatry', code: 'PSY', nationalQuota: 25 },
  { name: 'Radiology', code: 'RAD', nationalQuota: 30 },
  { name: 'Anesthesiology', code: 'ANES', nationalQuota: 30 },
  { name: 'Emergency Medicine', code: 'EM', nationalQuota: 35 },
  { name: 'Family Medicine', code: 'FM', nationalQuota: 40 },
  { name: 'Dermatology', code: 'DERM', nationalQuota: 15 },
  { name: 'Orthopedic Surgery', code: 'ORTHO', nationalQuota: 25 },
  { name: 'Ophthalmology', code: 'OPHTH', nationalQuota: 20 },
];

const buildCycle = () => ({
  name: '2026 Residency and Fellowship Cycle',
  year: 2026,
  status: 'open',
  startDate: new Date('2026-03-01'),
  endDate: new Date('2026-06-30'),
  submissionDeadline: new Date('2026-05-15'),
  rankingDeadline: new Date('2026-06-10'),
  resultPublicationDate: new Date('2026-06-25'),
  acceptanceWindowHours: 48,
});

const seed = async () => {
  try {
    await connectDB();

    console.log('Clearing existing seed data...');
    await Promise.all([
      Specialty.deleteMany({}),
      University.deleteMany({}),
      Cycle.deleteMany({}),
      Program.deleteMany({}),
    ]);

    console.log('Seeding universities...');
    const insertedUniversities = await University.insertMany(universities);

    console.log('Seeding specialties...');
    const insertedSpecialties = await Specialty.insertMany(specialties);

    console.log('Seeding cycle...');
    const cycle = await Cycle.create(buildCycle());

    console.log('Seeding programs...');
    const programs = [];
    for (const uni of insertedUniversities) {
      for (const spec of insertedSpecialties) {
        const capacity = Math.floor(Math.random() * 6) + 3;
        programs.push({
          university: uni._id,
          specialty: spec._id,
          cycle: cycle._id,
          track: 'residency',
          capacity,
          availableSeats: capacity,
          durationYears: 4,
          languageRequirement: uni.code === 'USJ' ? 'french' : 'english',
        });
      }
    }
    await Program.insertMany(programs);

    console.log(`Seeded: ${insertedUniversities.length} universities, ${insertedSpecialties.length} specialties, 1 cycle, ${programs.length} programs`);

const lgcEmail = 'lgc.admin@lrfap.gov.lb';
    const existingLgc = await User.findOne({ email: lgcEmail });
    if (!existingLgc) {
      await User.create({
        email: lgcEmail,
        password: 'LgcAdmin2026!',
        firstName: 'LGC',
        lastName: 'Administrator',
        role: 'lgc',
      });
      console.log(`Created LGC admin user: ${lgcEmail} / LgcAdmin2026!`);
    } else {
      console.log(`LGC admin already exists: ${lgcEmail}`);
    }

    const aub = insertedUniversities.find((u) => u.code === 'AUB');
    const uniEmail = 'aub.admin@lrfap.test';
    const existingUni = await User.findOne({ email: uniEmail });
    if (!existingUni) {
      await User.create({
        email: uniEmail,
        password: 'AubAdmin2026!',
        firstName: 'AUB',
        lastName: 'Reviewer',
        role: 'university',
        university: aub._id,
      });
      console.log(`Created AUB university user: ${uniEmail} / AubAdmin2026!`);
    } else {
      console.log(`AUB university user already exists: ${uniEmail}`);
    }

    await mongoose.disconnect();
    console.log('Seed complete.');
    process.exit(0);
  } catch (error) {
    console.error('Seed error:', error);
    process.exit(1);
  }
};

seed();