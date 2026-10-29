/** What changed, newest first: shown on the desktop title screen. Written like a studio's patch notes. */
export interface Release {
  version: string;
  date: string;
  /** The update's name. */
  title: string;
  intro: string;
  sections: { heading: 'New' | 'Improved' | 'Fixed'; notes: string[] }[];
}

export const PATCH_NOTES: Release[] = [
  {
    version: '1.1.0',
    date: 'November 2026',
    title: 'Earn it',
    intro: 'Our biggest update yet. TETRA now has a proper home on your desktop, a reason to chase every record, and skins you have to win.',
    sections: [
      {
        heading: 'New',
        notes: [
          'Achievements: 36 of them, in bronze, silver, gold and platinum. From your first drop to a sub-minute 40 Lines.',
          'Earn your skins: everyone starts with Studio, Clay, Neon and Mono. The other eleven are achievement rewards. NES is the hardest one to get. Good luck.',
          'Title screen: the desktop app opens on its own menu, with Play, Settings and Quit Game.',
          'Loading screen: the T drops in while the game gets ready.',
          'Mode setup: choose a mode and the board and skins slide in beside it. Only Play starts the run.',
          'Accounts: sign in once and your level, records, achievements and settings follow you everywhere.',
          'The desktop app now updates itself.',
          'Keyboard and controller previews in Settings show what every key and button does.',
        ],
      },
      {
        heading: 'Improved',
        notes: [
          'Controller support: glyphs switch to Xbox or PlayStation to match your pad.',
          'Controller navigation goes where you point the stick and repeats while held.',
          'Music library redesigned. Credits moved to Settings, Sound.',
          'Main menu redesigned around the mode wheel, with more room to breathe.',
          'Faster start-up: screens load when you need them.',
          'The TETRA Experience only plays by itself on your first launch. You can replay it from the top bar any time.',
        ],
      },
      {
        heading: 'Fixed',
        notes: [
          'Fixed the mode wheel text looking smeared while it turned.',
          'Fixed a glow spilling past the phone illustrations on Get the App.',
          'Fixed a second click on a mode starting a run by accident.',
          'Fixed locked skins appearing unlocked in the skin picker.',
          'Fixed the Focus preview keeping the TETRA Experience room.',
          'Fixed letters colliding in some large headlines.',
          'Various visual polish and stability fixes.',
        ],
      },
    ],
  },
  {
    version: '1.0.0',
    date: 'October 2026',
    title: 'Launch',
    intro: 'TETRA is out. Thank you for playing.',
    sections: [
      {
        heading: 'New',
        notes: [
          'TETRA for macOS and Windows.',
          'Install TETRA on your phone or tablet straight from the browser.',
          'Five OXIA Originals tracks, written for the game.',
          'The TETRA Experience, Focus mode, Versus, Cups and fifteen skins.',
        ],
      },
    ],
  },
];
