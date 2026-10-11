const ex = (name, sets) => ({ id: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'), name, sets });

export const DEFAULT_ROUTINE = {
  days: [
    { id: 'chest', name: 'Chest', exercises: [ex('Bench', 4), ex('Incline bench', 4), ex('Flys', 3)] },
    { id: 'shoulders', name: 'Shoulders', exercises: [ex('Shoulder press', 3), ex('Lat raises', 3), ex('Reverse flys', 3)] },
    {
      id: 'legs', name: 'Legs',
      exercises: [ex('Squat', 3), ex('Leg press', 3), ex('Leg curls', 3), ex('Leg extensions', 3), ex('Calf', 3)],
    },
    {
      id: 'arms', name: 'Arms',
      exercises: [ex('Preacher curls', 3), ex('Incline dumbbell curls', 3), ex('Tricep push down', 3), ex('Overhead tricep extension', 3)],
    },
    {
      id: 'back', name: 'Back',
      exercises: [ex('Lat pulldown', 3), ex('Cable row', 3), ex('1 arm dumbbell row', 3), ex('Straight arm cable pulldown', 3)],
    },
  ],
  notes: { 'Leg press': 'Feet high and wide (hamstrings)' },
  settings: {
    barWeight: 45,
    restSeconds: 90,
    barExercises: { Bench: true, 'Incline bench': true, Squat: true },
  },
};
