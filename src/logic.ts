import { questions, QuestionDimension } from './questions.js';

export type MBTIType = 'INTJ' | 'INFJ' | 'ENTJ' | 'ENFJ' | 'ISTJ' | 'ISFJ' | 'ESTJ' | 'ESFJ' | 'INTP' | 'INFP' | 'ENTP' | 'ENFP' | 'ISTP' | 'ISFP' | 'ESTP' | 'ESFP';

type MBTIStrengths = { EI: number; SN: number; TF: number; JP: number };
export interface AssessmentResults {
  mbti: MBTIType;
  mbtiStrengths: MBTIStrengths;
  bigFive: { openness: number; conscientiousness: number; extraversion: number; agreeableness: number; emotionalStability: number };
  ei: { selfAwareness: number; selfRegulation: number; motivation: number; empathy: number; socialSkills: number };
  evidence: { responseConsistency: number; answeredCount: number; expectedCount: number; constructSpread: Record<string, number> };
}

const MBTI_PAIRS: Array<[QuestionDimension, QuestionDimension, keyof MBTIStrengths]> = [
  ['E', 'I', 'EI'], ['S', 'N', 'SN'], ['T', 'F', 'TF'], ['J', 'P', 'JP']
];

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));
const scale = (average: number) => clamp(((average - 1) / 4) * 100);

export function calculateResults(answers: Record<number, number>): AssessmentResults {
  const scores: Record<string, number[]> = {};
  questions.forEach((q) => {
    if (!scores[q.dimension]) scores[q.dimension] = [];
    const raw = Number.isFinite(answers[q.id]) ? answers[q.id] : 3;
    const answer = Math.max(1, Math.min(5, raw));
    scores[q.dimension].push(q.direction === 1 ? answer : 6 - answer);
  });

  const avg = (dimension: string) => {
    const values = scores[dimension] || [];
    return values.length ? values.reduce((a, b) => a + b, 0) / values.length : 3;
  };

  const E = avg('E'), I = avg('I'), S = avg('S'), N = avg('N'), T = avg('T'), F = avg('F'), J = avg('J'), P = avg('P');
  const mbti = `${E > I ? 'E' : 'I'}${S > N ? 'S' : 'N'}${T > F ? 'T' : 'F'}${J > P ? 'J' : 'P'}` as MBTIType;
  const strength = (a: number, b: number) => clamp(50 + ((a - b) / 4) * 50);

  const constructKeys = ['O', 'C', 'BF_E', 'A', 'N_BF', 'EI_SA', 'EI_SR', 'EI_MO', 'EI_EM', 'EI_SS'];
  const constructSpread: Record<string, number> = {};
  constructKeys.forEach((key) => {
    const values = scores[key] || [];
    if (values.length > 1) {
      const mean = values.reduce((a, b) => a + b, 0) / values.length;
      const variance = values.reduce((sum, value) => sum + Math.pow(value - mean, 2), 0) / values.length;
      constructSpread[key] = Math.sqrt(variance);
    } else constructSpread[key] = 0;
  });
  const answeredCount = Object.keys(answers).filter((id) => questions.some((q) => q.id === Number(id))).length;
  const responseConsistency = clamp(100 - Object.values(constructSpread).reduce((a, b) => a + b, 0) / Math.max(1, Object.values(constructSpread).length) * 28);

  return {
    mbti,
    mbtiStrengths: { EI: strength(E, I), SN: strength(S, N), TF: strength(T, F), JP: strength(J, P) },
    bigFive: {
      openness: scale(avg('O')),
      conscientiousness: scale(avg('C')),
      extraversion: scale(avg('BF_E')),
      agreeableness: scale(avg('A')),
      emotionalStability: scale(6 - avg('N_BF')),
    },
    ei: {
      selfAwareness: scale(avg('EI_SA')),
      selfRegulation: scale(avg('EI_SR')),
      motivation: scale(avg('EI_MO')),
      empathy: scale(avg('EI_EM')),
      socialSkills: scale(avg('EI_SS')),
    },
    evidence: {
      responseConsistency,
      answeredCount,
      expectedCount: questions.length,
      constructSpread,
    },
  };
}

export const typeDescriptions: Record<MBTIType, { title: string; subtitle: string; description: string; strengths: string[]; challenges: string[]; workplace: string; growth: string }> = {
  INTJ: { title: 'The Architect', subtitle: 'The Mastermind', description: 'You are a natural long-range thinker. Where others see a problem, you see a system. Where others react to the present, you are already three moves ahead, running scenarios, testing assumptions, stress-testing outcomes. This is not something you choose to do – it is simply how your mind organises reality.', strengths: ['Strategic planning', 'Logical problem-solving', 'High independence', 'Systemic thinking'], challenges: ['Perfectionism', 'Impatience with inefficiency', 'Over-analyzing social situations', 'Difficulty with emotional expression'], workplace: 'You thrive in environments that reward innovation and autonomous strategic work. You prefer merit-based systems over social hierarchies.', growth: "Focus on developing interpersonal empathy and recognizing the value of 'good enough' to avoid analysis paralysis." },
  INFJ: { title: 'The Advocate', subtitle: 'The Idealist', description: 'You have an inborn sense of idealism and morality, but what sets you apart is that you are not an idle dreamer. You are capable of taking concrete steps to realize your goals and make a lasting positive impact.', strengths: ['Deep empathy', 'Visionary thinking', 'Strong values', 'Insightful communication'], challenges: ['Burnout from over-extending', 'Sensitivity to criticism', 'Difficulty opening up', 'Perfectionism'], workplace: 'You excel in roles that align with your personal mission and allow for deep, meaningful connection with others.', growth: "Practice setting healthy boundaries and acknowledging that you cannot solve everyone's problems." },
  ENTJ: { title: 'The Commander', subtitle: 'The Strategist', description: 'You are a natural-born leader. You embody the gifts of charisma and confidence, and you exercise authority in a way that draws crowds together behind a common goal.', strengths: ['Strategic leadership', 'Decisiveness', 'Efficiency', 'Confidence'], challenges: ['Intolerance', 'Arrogance', 'Poor handling of emotions', 'Coldness'], workplace: 'You dominate in high-stakes environments where clear goals and decisive action are required.', growth: 'Learn to value the emotional input of others and understand that consensus can sometimes be more effective than command.' },
  ENFJ: { title: 'The Protagonist', subtitle: 'The Giver', description: 'You are a natural-born leader, full of passion and charisma. You are often found in roles where you can guide others to grow and improve.', strengths: ['Inspirational', 'Reliable', 'Charismatic', 'Altruistic'], challenges: ['Overly idealistic', 'Too sensitive', 'Fluctuating self-esteem', 'Struggle with tough decisions'], workplace: 'You thrive in collaborative environments where you can mentor others and foster community.', growth: "Recognize that you cannot please everyone and that conflict is sometimes necessary for progress." },
  ISTJ: { title: 'The Logistician', subtitle: 'The Inspector', description: 'You are defined by your integrity, practical logic, and tireless dedication to duty. You are the backbone of many organizations.', strengths: ['Honest and direct', 'Strong-willed', 'Responsible', 'Calm and practical'], challenges: ['Stubborn', 'Insensitive', 'Always by the book', 'Often judge others'], workplace: 'You are best suited to structured environments where accuracy, reliability, and tradition are valued.', growth: 'Try to be more open to new, unconventional ideas and understand that rules sometimes need flexibility.' },
  ISFJ: { title: 'The Defender', subtitle: 'The Protector', description: 'You are a true altruist, meeting kindness with kindness-in-excess and engaging the work and people you believe in with enthusiasm and generosity.', strengths: ['Supportive', 'Reliable', 'Observant', 'Hard-working'], challenges: ['Humble to a fault', 'Take things personally', 'Repress feelings', 'Overload themselves'], workplace: 'You excel in supportive roles where you can provide practical help and maintain order.', growth: 'Learn to advocate for your own needs and accept credit for your hard work.' },
  ESTJ: { title: 'The Executive', subtitle: 'The Guardian', description: 'You are a representative of tradition and order, utilizing your understanding of what is right, wrong and socially acceptable to bring families and communities together.', strengths: ['Dedicated', 'Strong-willed', 'Direct and honest', 'Excellent organizers'], challenges: ['Inflexible', 'Uncomfortable with unconventional situations', 'Judgmental', 'Too focused on social status'], workplace: 'You thrive in leadership roles that require clear structure, accountability, and results.', growth: 'Practice patience with those who have different working styles and be more open to change.' },
  ESFJ: { title: 'The Consul', subtitle: 'The Provider', description: 'You are a social creature who thrives on staying up to date with what your friends are doing. You are supportive and outgoing.', strengths: ['Strong practical skills', 'Strong sense of duty', 'Very loyal', 'Sensitive and warm'], challenges: ['Worried about social status', 'Inflexible', 'Reluctant to innovate', 'Too selfless'], workplace: 'You are at your best in roles that involve direct interaction with people and require high levels of cooperation.', growth: 'Develop a thicker skin regarding criticism and learn to make decisions based on logic rather than just social harmony.' },
  INTP: { title: 'The Logician', subtitle: 'The Thinker', description: 'You pride yourself on your inventiveness and creativity, your unique perspective and vigorous intellect.', strengths: ['Analytical', 'Original', 'Open-minded', 'Enthusiastic'], challenges: ['Absent-minded', 'Condescending', 'Loathe rules and guidelines', 'May tend to second-guess themselves'], workplace: 'You thrive in theoretical or creative roles that allow for deep independent analysis and problem-solving.', growth: 'Work on translating your complex ideas into actionable steps and improving your interpersonal communication.' },
  INFP: { title: 'The Mediator', subtitle: 'The Idealist', description: 'You are a true idealist, always looking for the hint of good in even the worst of people and events, searching for ways to make things better.', strengths: ['Idealistic', 'Seek harmony', 'Open-minded', 'Creative'], challenges: ['Too idealistic', 'Too altruistic', 'Impractical', 'Dislike dealing with data'], workplace: 'You are at your best in creative or service-oriented roles that align with your personal values and allow for self-expression.', growth: 'Focus on developing practical skills to ground your idealism and learn to handle conflict more directly.' },
  ENTP: { title: 'The Debater', subtitle: 'The Visionary', description: "You are the ultimate devil's advocate, thriving on the process of shredding arguments and beliefs and letting the ribbons drift in the wind for all to see.", strengths: ['Knowledgeable', 'Quick thinker', 'Original', 'Excellent brainstormer'], challenges: ['Very argumentative', 'Insensitive', 'Intolerant', 'Can find it difficult to focus'], workplace: 'You excel in roles that require constant innovation, strategic thinking, and challenging the status quo.', growth: "Learn to follow through on your ideas and be more mindful of how your debating style affects others' feelings." },
  ENFP: { title: 'The Campaigner', subtitle: 'The Champion', description: 'You are a true free spirit. You are often the life of the party, but unlike types in the Explorer role group, you are less interested in the sheer excitement and pleasure of the moment than you are in enjoying the social and emotional connections you make with others.', strengths: ['Curious', 'Observant', 'Energetic', 'Excellent communicator'], challenges: ['Poor practical skills', 'Find it difficult to focus', 'Overthink things', 'Get stressed easily'], workplace: 'You thrive in creative, people-oriented environments where you can explore new ideas and inspire others.', growth: 'Work on your organizational skills and learn to prioritize tasks to avoid becoming overwhelmed.' },
  ISTP: { title: 'The Virtuoso', subtitle: 'The Craftsman', description: 'You love to explore with your hands and your eyes, touching and examining the world around you with cool rationalism and spirited curiosity.', strengths: ['Optimistic and energetic', 'Creative and practical', 'Prioritize', 'Great in a crisis'], challenges: ['Stubborn', 'Insensitive', 'Private and reserved', 'Easily bored'], workplace: 'You are at your best in hands-on, technical, or analytical roles that offer variety and immediate problem-solving.', growth: 'Try to be more communicative about your thoughts and plans to avoid isolating yourself from your team.' },
  ISFP: { title: 'The Adventurer', subtitle: 'The Artist', description: "You are a true artist, but not necessarily in the conventional sense of being out painting happy little trees. Often enough though, you are perfectly capable of that too.", strengths: ['Charming', 'Sensitive to others', 'Imaginative', 'Passionate'], challenges: ['Fierce independence', 'Unpredictable', 'Easily stressed', 'Overly competitive'], workplace: 'You excel in creative or practical roles that allow for personal expression and a flexible schedule.', growth: 'Work on long-term planning and learn to handle criticism as a tool for growth rather than a personal attack.' },
  ESTP: { title: 'The Entrepreneur', subtitle: 'The Dynamo', description: 'You always have an impact on your immediate surroundings – the best way to spot you at a party is to look for the eddy of people flitting about you as you move from group to group.', strengths: ['Bold', 'Rational and practical', 'Direct', 'Sociable'], challenges: ['Insensitive', 'Impatient', 'Risk-prone', 'Unstructured'], workplace: 'You thrive in fast-paced, action-oriented environments that require quick thinking and social influence.', growth: "Learn to consider the long-term consequences of your actions and be more mindful of others' emotional boundaries." },
  ESFP: { title: 'The Entertainer', subtitle: 'The Performer', description: 'You get caught up in the excitement of the moment, and want everyone else to feel that way, too. No other personality type is as generous with its time and energy when it comes to encouraging others.', strengths: ['Bold', 'Original', 'Aesthetics and showmanship', 'Practical'], challenges: ['Sensitive', 'Conflict-averse', 'Easily bored', 'Poor long-term planners'], workplace: 'You are at your best in roles that involve direct interaction with people and allow you to use your social skills and creativity.', growth: 'Work on your focus and long-term planning skills to ensure your enthusiasm leads to sustainable results.' }
};
