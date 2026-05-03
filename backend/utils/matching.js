const runGaleShapley = ({ applicants, programs }) => {
  const applicantMap = new Map();
  for (const a of applicants) {
    applicantMap.set(a.id, {
      ...a,
      preferences: [...a.preferences],
      nextProposalIndex: 0,
      matchedTo: null,
    });
  }

  const programMap = new Map();
  for (const p of programs) {
    const rankMap = new Map();
    p.rankedApplicants.forEach((applicantId, index) => {
      rankMap.set(applicantId, index);
    });
    programMap.set(p.id, {
      ...p,
      rankMap,
      currentMatches: [],
    });
  }

  const tieBreak = (a, b) => {
    if (a.submittedAt && b.submittedAt) {
      return new Date(a.submittedAt) - new Date(b.submittedAt);
    }
    return a.id.localeCompare(b.id);
  };

  let changed = true;
  let iterations = 0;
  const maxIterations = applicants.length * programs.length * 10;

  while (changed && iterations < maxIterations) {
    changed = false;
    iterations++;

    for (const applicant of applicantMap.values()) {
      if (applicant.matchedTo) continue;
      if (applicant.nextProposalIndex >= applicant.preferences.length) continue;

      const programId = applicant.preferences[applicant.nextProposalIndex];
      applicant.nextProposalIndex++;
      changed = true;

      const program = programMap.get(programId);
      if (!program) continue;
      if (!program.rankMap.has(applicant.id)) continue;

      const applicantRank = program.rankMap.get(applicant.id);

      if (program.currentMatches.length < program.capacity) {
        program.currentMatches.push({ applicantId: applicant.id, rank: applicantRank });
        applicant.matchedTo = program.id;
      } else {
        let worstIndex = -1;
        let worstRank = -Infinity;
        let worstApplicantData = null;

        program.currentMatches.forEach((m, idx) => {
          const existing = applicantMap.get(m.applicantId);
          if (
            m.rank > worstRank ||
            (m.rank === worstRank && worstApplicantData && tieBreak(existing, worstApplicantData) > 0)
          ) {
            worstRank = m.rank;
            worstIndex = idx;
            worstApplicantData = existing;
          }
        });

        const shouldDisplace =
          applicantRank < worstRank ||
          (applicantRank === worstRank && tieBreak(applicant, worstApplicantData) < 0);

        if (shouldDisplace) {
          const displaced = applicantMap.get(program.currentMatches[worstIndex].applicantId);
          displaced.matchedTo = null;
          program.currentMatches[worstIndex] = { applicantId: applicant.id, rank: applicantRank };
          applicant.matchedTo = program.id;
        }
      }
    }
  }

  const matches = [];
  const unmatchedApplicants = [];
  for (const applicant of applicantMap.values()) {
    if (applicant.matchedTo) {
      matches.push({ applicantId: applicant.id, programId: applicant.matchedTo });
    } else {
      unmatchedApplicants.push(applicant.id);
    }
  }

  const programFillRates = [];
  for (const program of programMap.values()) {
    programFillRates.push({
      programId: program.id,
      capacity: program.capacity,
      filled: program.currentMatches.length,
      unfilled: program.capacity - program.currentMatches.length,
    });
  }

  return {
    matches,
    unmatchedApplicants,
    programFillRates,
    iterations,
    totalApplicants: applicants.length,
    totalPrograms: programs.length,
    totalMatched: matches.length,
  };
};

module.exports = { runGaleShapley };