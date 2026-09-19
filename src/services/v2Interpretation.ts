import { AssessmentResults } from '../logic.js';

export type SignalBand = 'STRONG' | 'MODERATE' | 'DEVELOPING';
export type Insight = { title: string; text: string; band: SignalBand };

const band = (score: number): SignalBand => score >= 75 ? 'STRONG' : score >= 55 ? 'MODERATE' : 'DEVELOPING';
const top = (items: Array<[string, number]>, n = 2) => [...items].sort((a, b) => b[1] - a[1]).slice(0, n);
const low = (items: Array<[string, number]>, n = 2) => [...items].sort((a, b) => a[1] - b[1]).slice(0, n);

export function frameworkSummary(results: AssessmentResults): Insight[] {
  const b = results.bigFive;
  const e = results.ei;
  const strengths = top([
    ['openness', b.openness], ['conscientiousness', b.conscientiousness], ['extraversion', b.extraversion], ['agreeableness', b.agreeableness], ['emotional stability', b.emotionalStability],
    ['self-awareness', e.selfAwareness], ['self-regulation', e.selfRegulation], ['motivation', e.motivation], ['empathy', e.empathy], ['social skills', e.socialSkills],
  ], 3);
  const weaker = low([
    ['openness', b.openness], ['conscientiousness', b.conscientiousness], ['extraversion', b.extraversion], ['agreeableness', b.agreeableness], ['emotional stability', b.emotionalStability],
    ['self-awareness', e.selfAwareness], ['self-regulation', e.selfRegulation], ['motivation', e.motivation], ['empathy', e.empathy], ['social skills', e.socialSkills],
  ], 2);

  const insights: Insight[] = [
    {
      title: 'Dominant pattern', band: band((strengths[0]?.[1] ?? 50)),
      text: `The strongest measured indicators are ${strengths.map(([name]) => name).join(', ')}. Taken together, these results suggest a profile with identifiable resources in these areas rather than a single defining characteristic.`,
    },
    {
      title: 'Developmental tension', band: band(100 - (weaker[0]?.[1] ?? 50)),
      text: `The areas producing the lowest scaled indicators are ${weaker.map(([name]) => name).join(' and ')}. These should be treated as areas to understand and develop, not as deficits or predictions of poor performance.`,
    },
  ];

  const social = (b.extraversion + e.socialSkills + e.empathy) / 3;
  const regulation = (b.emotionalStability + e.selfRegulation) / 2;
  const execution = (b.conscientiousness + e.motivation) / 2;
  const exploration = (b.openness + (results.mbti.includes('N') ? 75 : 45)) / 2;

  insights.push({
    title: 'Thinking and exploration', band: band(exploration),
    text: exploration >= 75
      ? 'The profile shows strong evidence for curiosity, pattern-seeking and willingness to consider possibilities beyond the immediately obvious.'
      : exploration >= 55
        ? 'The profile suggests a balanced approach to exploration: the candidate can work with established information while considering alternative possibilities when useful.'
        : 'The profile suggests a preference for concrete, immediately relevant information, with exploration more likely to be strongest when it has a clear practical purpose.',
  });
  insights.push({
    title: 'Interpersonal effectiveness', band: band(social),
    text: social >= 75
      ? 'The combination of interpersonal and social indicators suggests a strong capacity to engage with people, adjust communication and attend to interpersonal cues.'
      : social >= 55
        ? 'The interpersonal indicators suggest useful social capacity, with effectiveness likely to depend on context, relationship quality and the demands of the situation.'
        : 'The profile suggests that social energy or interpersonal engagement may require more deliberate effort, while empathy and communication can still provide important strengths.',
  });
  insights.push({
    title: 'Regulation under pressure', band: band(regulation),
    text: regulation >= 75
      ? 'Emotional stability and self-regulation combine to suggest a capacity to remain comparatively controlled and effective when pressure increases.'
      : regulation >= 55
        ? 'The results suggest reasonable regulation capacity, with the strongest performance likely when expectations, priorities and recovery time are well managed.'
        : 'The results indicate that sustained pressure may place greater demands on emotional regulation. This is an appropriate area for practical exploration rather than a fixed judgement.',
  });
  insights.push({
    title: 'Execution and persistence', band: band(execution),
    text: execution >= 75
      ? 'Conscientiousness and motivation provide converging evidence for persistence, follow-through and a willingness to continue working toward meaningful objectives.'
      : execution >= 55
        ? 'The profile suggests adequate execution resources, with consistency likely to be influenced by structure, priorities and personal engagement with the objective.'
        : 'Execution indicators suggest that sustained follow-through may benefit from clear priorities, visible milestones and deliberate accountability structures.',
  });

  return insights;
}

const MBTI_WORD: Record<string, string> = {
  E: 'Extraversion', I: 'Introversion', S: 'Sensing', N: 'Intuition', T: 'Thinking', F: 'Feeling', J: 'Judging', P: 'Perceiving',
};

export function mbtiPreferenceText(results: AssessmentResults): string {
  const s = results.mbtiStrengths ?? results.ei?._v2Meta?.mbtiStrengths;
  if (!s) return `The MBTI result is ${results.mbti}. Preference strength data was not retained in this submission record, so the four-letter result is presented without a strength claim.`;
  const entries: Array<[string, number]> = [
    [MBTI_WORD[results.mbti[0]], s.EI], [MBTI_WORD[results.mbti[1]], s.SN], [MBTI_WORD[results.mbti[2]], s.TF], [MBTI_WORD[results.mbti[3]], s.JP],
  ];
  const strongest = [...entries].sort((a, b) => Math.abs(b[1] - 50) - Math.abs(a[1] - 50))[0];
  return `The MBTI result is ${results.mbti}. Of the four preference pairs, the clearest relative preference is ${strongest[0]}, while the other dimensions should be read as part of the overall pattern rather than as absolute categories.`;
}