export type QuestionFramework = 'MBTI' | 'BIG_FIVE' | 'EQ';
export type QuestionDimension = 'E' | 'I' | 'S' | 'N' | 'T' | 'F' | 'J' | 'P' | 'O' | 'C' | 'BF_E' | 'A' | 'N_BF' | 'EI_SA' | 'EI_SR' | 'EI_MO' | 'EI_EM' | 'EI_SS';

export interface Question {
  id: number;
  text: string;
  framework: QuestionFramework;
  dimension: QuestionDimension;
  direction: 1 | -1;
  evidenceRole: 'primary' | 'reinforcing';
}

export const questions: Question[] = [
  // MBTI — E / I
  { id: 1, text: 'I feel more energised when I have regular interaction with other people.', framework: 'MBTI', dimension: 'E', direction: 1, evidenceRole: 'primary' },
  { id: 2, text: 'I naturally think things through by talking them over with others.', framework: 'MBTI', dimension: 'E', direction: 1, evidenceRole: 'primary' },
  { id: 3, text: 'I enjoy being actively involved in group discussions.', framework: 'MBTI', dimension: 'E', direction: 1, evidenceRole: 'primary' },
  { id: 4, text: 'I usually seek interaction rather than extended periods of solitude.', framework: 'MBTI', dimension: 'E', direction: 1, evidenceRole: 'primary' },
  { id: 5, text: 'I need time alone to fully recharge after substantial social interaction.', framework: 'MBTI', dimension: 'I', direction: 1, evidenceRole: 'primary' },
  { id: 6, text: 'I prefer to develop my thoughts privately before discussing them.', framework: 'MBTI', dimension: 'I', direction: 1, evidenceRole: 'primary' },
  { id: 7, text: 'I am comfortable spending long periods working independently.', framework: 'MBTI', dimension: 'I', direction: 1, evidenceRole: 'primary' },
  { id: 8, text: 'I generally prefer a few meaningful interactions to being involved with many people.', framework: 'MBTI', dimension: 'I', direction: 1, evidenceRole: 'primary' },

  // MBTI — S / N
  { id: 9, text: 'I prefer information that is specific, practical and clearly grounded in facts.', framework: 'MBTI', dimension: 'S', direction: 1, evidenceRole: 'primary' },
  { id: 10, text: 'I naturally pay attention to concrete details when dealing with a situation.', framework: 'MBTI', dimension: 'S', direction: 1, evidenceRole: 'primary' },
  { id: 11, text: 'I prefer to work from information that can be directly observed or verified.', framework: 'MBTI', dimension: 'S', direction: 1, evidenceRole: 'primary' },
  { id: 12, text: 'When solving a problem, I usually start with what is known and immediately relevant.', framework: 'MBTI', dimension: 'S', direction: 1, evidenceRole: 'primary' },
  { id: 13, text: 'I naturally look for patterns and connections beyond the information immediately available.', framework: 'MBTI', dimension: 'N', direction: 1, evidenceRole: 'primary' },
  { id: 14, text: 'I enjoy exploring possibilities that have not yet been tested.', framework: 'MBTI', dimension: 'N', direction: 1, evidenceRole: 'primary' },
  { id: 15, text: 'I am often more interested in the underlying meaning of something than its individual details.', framework: 'MBTI', dimension: 'N', direction: 1, evidenceRole: 'primary' },
  { id: 16, text: 'When considering a problem, I naturally think about what it could become rather than only what it currently is.', framework: 'MBTI', dimension: 'N', direction: 1, evidenceRole: 'primary' },

  // MBTI — T / F
  { id: 17, text: 'I prefer decisions to be based on consistent principles rather than personal preferences.', framework: 'MBTI', dimension: 'T', direction: 1, evidenceRole: 'primary' },
  { id: 18, text: 'When making an important decision, I first examine the facts and logic involved.', framework: 'MBTI', dimension: 'T', direction: 1, evidenceRole: 'primary' },
  { id: 19, text: 'I am willing to make an unpopular decision when I believe it is the most logical one.', framework: 'MBTI', dimension: 'T', direction: 1, evidenceRole: 'primary' },
  { id: 20, text: 'I naturally look for weaknesses or inconsistencies in an argument.', framework: 'MBTI', dimension: 'T', direction: 1, evidenceRole: 'primary' },
  { id: 21, text: 'When making an important decision, I consider how it will affect the people involved.', framework: 'MBTI', dimension: 'F', direction: 1, evidenceRole: 'primary' },
  { id: 22, text: 'I place considerable value on maintaining harmony between people.', framework: 'MBTI', dimension: 'F', direction: 1, evidenceRole: 'primary' },
  { id: 23, text: 'I consider personal values and human consequences alongside practical considerations.', framework: 'MBTI', dimension: 'F', direction: 1, evidenceRole: 'primary' },
  { id: 24, text: 'I naturally consider whether a decision feels fair to the people affected by it.', framework: 'MBTI', dimension: 'F', direction: 1, evidenceRole: 'primary' },

  // MBTI — J / P
  { id: 25, text: 'I prefer to know what needs to be done before I begin a task.', framework: 'MBTI', dimension: 'J', direction: 1, evidenceRole: 'primary' },
  { id: 26, text: 'I feel more comfortable when important decisions have been settled.', framework: 'MBTI', dimension: 'J', direction: 1, evidenceRole: 'primary' },
  { id: 27, text: 'I naturally organise my activities around plans and priorities.', framework: 'MBTI', dimension: 'J', direction: 1, evidenceRole: 'primary' },
  { id: 28, text: 'I prefer to establish a clear structure rather than leave important matters open-ended.', framework: 'MBTI', dimension: 'J', direction: 1, evidenceRole: 'primary' },
  { id: 29, text: 'I prefer to keep several possibilities open until I have more information.', framework: 'MBTI', dimension: 'P', direction: 1, evidenceRole: 'primary' },
  { id: 30, text: 'I am comfortable changing direction when circumstances change.', framework: 'MBTI', dimension: 'P', direction: 1, evidenceRole: 'primary' },
  { id: 31, text: 'I often prefer to explore a situation before deciding exactly how to proceed.', framework: 'MBTI', dimension: 'P', direction: 1, evidenceRole: 'primary' },
  { id: 32, text: 'I find flexibility more useful than a fixed plan when circumstances are uncertain.', framework: 'MBTI', dimension: 'P', direction: 1, evidenceRole: 'primary' },

  // BIG FIVE — Openness
  { id: 33, text: 'I enjoy exploring ideas that challenge the way I normally think.', framework: 'BIG_FIVE', dimension: 'O', direction: 1, evidenceRole: 'primary' },
  { id: 34, text: 'I am curious about subjects that are unfamiliar to me.', framework: 'BIG_FIVE', dimension: 'O', direction: 1, evidenceRole: 'primary' },
  { id: 35, text: 'I enjoy considering several different ways of interpreting a situation.', framework: 'BIG_FIVE', dimension: 'O', direction: 1, evidenceRole: 'primary' },
  { id: 36, text: 'I am drawn to complex ideas even when they require considerable thought.', framework: 'BIG_FIVE', dimension: 'O', direction: 1, evidenceRole: 'primary' },
  { id: 37, text: 'I actively seek experiences that expose me to new perspectives.', framework: 'BIG_FIVE', dimension: 'O', direction: 1, evidenceRole: 'primary' },

  // BIG FIVE — Conscientiousness
  { id: 38, text: 'I reliably follow through on commitments I have made.', framework: 'BIG_FIVE', dimension: 'C', direction: 1, evidenceRole: 'primary' },
  { id: 39, text: 'I organise my work so that important tasks are not overlooked.', framework: 'BIG_FIVE', dimension: 'C', direction: 1, evidenceRole: 'primary' },
  { id: 40, text: 'I continue working toward an objective even when progress is slow.', framework: 'BIG_FIVE', dimension: 'C', direction: 1, evidenceRole: 'primary' },
  { id: 41, text: 'I pay close attention to important details before considering work complete.', framework: 'BIG_FIVE', dimension: 'C', direction: 1, evidenceRole: 'primary' },
  { id: 42, text: 'I sometimes postpone important tasks until they become urgent.', framework: 'BIG_FIVE', dimension: 'C', direction: -1, evidenceRole: 'primary' },

  // BIG FIVE — Extraversion, independent of MBTI
  { id: 43, text: 'I am comfortable taking an active role in group situations.', framework: 'BIG_FIVE', dimension: 'BF_E', direction: 1, evidenceRole: 'primary' },
  { id: 44, text: 'I tend to speak up when I have something useful to contribute.', framework: 'BIG_FIVE', dimension: 'BF_E', direction: 1, evidenceRole: 'primary' },
  { id: 45, text: 'I enjoy environments where there is frequent interaction with other people.', framework: 'BIG_FIVE', dimension: 'BF_E', direction: 1, evidenceRole: 'primary' },
  { id: 46, text: 'I am generally comfortable approaching people I do not know.', framework: 'BIG_FIVE', dimension: 'BF_E', direction: 1, evidenceRole: 'primary' },
  { id: 47, text: 'I usually prefer to remain in the background during group activities.', framework: 'BIG_FIVE', dimension: 'BF_E', direction: -1, evidenceRole: 'primary' },

  // BIG FIVE — Agreeableness
  { id: 48, text: 'I make a genuine effort to understand the needs of other people.', framework: 'BIG_FIVE', dimension: 'A', direction: 1, evidenceRole: 'primary' },
  { id: 49, text: 'I am willing to compromise when doing so helps maintain a constructive relationship.', framework: 'BIG_FIVE', dimension: 'A', direction: 1, evidenceRole: 'primary' },
  { id: 50, text: 'I can disagree with someone without losing respect for them.', framework: 'BIG_FIVE', dimension: 'A', direction: 1, evidenceRole: 'primary' },
  { id: 51, text: 'I can be dismissive of other people\'s concerns when I believe my own position is correct.', framework: 'BIG_FIVE', dimension: 'A', direction: -1, evidenceRole: 'primary' },

  // BIG FIVE — Emotional Stability
  { id: 52, text: 'I remain reasonably calm when unexpected problems arise.', framework: 'BIG_FIVE', dimension: 'N_BF', direction: -1, evidenceRole: 'primary' },
  { id: 53, text: 'I tend to recover emotionally after a difficult experience.', framework: 'BIG_FIVE', dimension: 'N_BF', direction: -1, evidenceRole: 'primary' },
  { id: 54, text: 'I often worry about things that might go wrong.', framework: 'BIG_FIVE', dimension: 'N_BF', direction: 1, evidenceRole: 'primary' },
  { id: 55, text: 'Under sustained pressure, I can become emotionally overwhelmed.', framework: 'BIG_FIVE', dimension: 'N_BF', direction: 1, evidenceRole: 'primary' },
  { id: 56, text: 'I generally maintain an even emotional balance during demanding periods.', framework: 'BIG_FIVE', dimension: 'N_BF', direction: -1, evidenceRole: 'primary' },

  // EQ — Self-Awareness
  { id: 57, text: 'I can usually identify what emotion I am experiencing.', framework: 'EQ', dimension: 'EI_SA', direction: 1, evidenceRole: 'primary' },
  { id: 58, text: 'I recognise how my emotional state can influence my behaviour.', framework: 'EQ', dimension: 'EI_SA', direction: 1, evidenceRole: 'primary' },
  { id: 59, text: 'I have a realistic understanding of both my strengths and limitations.', framework: 'EQ', dimension: 'EI_SA', direction: 1, evidenceRole: 'primary' },
  { id: 60, text: 'I notice when my emotions are affecting the way I interpret a situation.', framework: 'EQ', dimension: 'EI_SA', direction: 1, evidenceRole: 'primary' },

  // EQ — Self-Regulation
  { id: 61, text: 'I can control my immediate reaction when something frustrates me.', framework: 'EQ', dimension: 'EI_SR', direction: 1, evidenceRole: 'primary' },
  { id: 62, text: 'I can remain effective even when I am emotionally unsettled.', framework: 'EQ', dimension: 'EI_SR', direction: 1, evidenceRole: 'primary' },
  { id: 63, text: 'I usually pause to consider the consequences before acting on an impulse.', framework: 'EQ', dimension: 'EI_SR', direction: 1, evidenceRole: 'primary' },
  { id: 64, text: 'I can regain my composure after a setback.', framework: 'EQ', dimension: 'EI_SR', direction: 1, evidenceRole: 'primary' },

  // EQ — Motivation
  { id: 65, text: 'I continue working toward important goals even when progress is difficult.', framework: 'EQ', dimension: 'EI_MO', direction: 1, evidenceRole: 'primary' },
  { id: 66, text: 'I set standards for myself that encourage me to keep improving.', framework: 'EQ', dimension: 'EI_MO', direction: 1, evidenceRole: 'primary' },
  { id: 67, text: 'I am motivated by achieving goals that are personally meaningful to me.', framework: 'EQ', dimension: 'EI_MO', direction: 1, evidenceRole: 'primary' },
  { id: 68, text: 'When something goes wrong, I usually look for a way forward rather than give up.', framework: 'EQ', dimension: 'EI_MO', direction: 1, evidenceRole: 'primary' },

  // EQ — Empathy
  { id: 69, text: 'I can usually recognise when someone is uncomfortable even if they do not say so.', framework: 'EQ', dimension: 'EI_EM', direction: 1, evidenceRole: 'primary' },
  { id: 70, text: 'I make an effort to understand a situation from another person\'s point of view.', framework: 'EQ', dimension: 'EI_EM', direction: 1, evidenceRole: 'primary' },
  { id: 71, text: 'I notice changes in people\'s tone, expression or body language.', framework: 'EQ', dimension: 'EI_EM', direction: 1, evidenceRole: 'primary' },
  { id: 72, text: 'I can usually sense when another person\'s emotional state differs from what they are saying.', framework: 'EQ', dimension: 'EI_EM', direction: 1, evidenceRole: 'primary' },

  // EQ — Social Skills
  { id: 73, text: 'I can establish a comfortable working relationship with people I have just met.', framework: 'EQ', dimension: 'EI_SS', direction: 1, evidenceRole: 'primary' },
  { id: 74, text: 'I can help people work through disagreements constructively.', framework: 'EQ', dimension: 'EI_SS', direction: 1, evidenceRole: 'primary' },
  { id: 75, text: 'I can adjust my communication style when dealing with different people.', framework: 'EQ', dimension: 'EI_SS', direction: 1, evidenceRole: 'primary' },
  { id: 76, text: 'I can encourage people to work toward a shared objective.', framework: 'EQ', dimension: 'EI_SS', direction: 1, evidenceRole: 'primary' },
];
