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
    version: '1.1.3',
    date: 'November 2026',
    title: 'Playtest',
    intro: "TETRA is opening up to playtesters. Spot something off? Tell us from inside the game, it lands straight in the studio's inbox.",
    sections: [
      {
        heading: 'New',
        notes: [
          'Report a bug from Settings, the main menu or the title screen: bugs, visual glitches or ideas, with an optional email so we can reply.',
          'Reports can include your version and device details, so we can reproduce what you saw. You choose.',
        ],
      },
      {
        heading: 'Improved',
        notes: ['The first update to install itself on Mac. If you are reading this after a Restart, it worked.'],
      },
    ],
  },
  {
    version: '1.1.2',
    date: 'November 2026',
    title: 'Seamless',
    intro: 'Updates now install themselves on Mac too. This is the last one you download by hand.',
    sections: [
      {
        heading: 'Improved',
        notes: [
          'macOS: new versions download in the background and install with one tap on Restart, or the next time you quit. No more reinstalling.',
        ],
      },
    ],
  },
  {
    version: '1.1.1',
    date: 'November 2026',
    title: 'Hotfix',
    intro: 'A quick fix so everyone can create an account, wherever they open their email.',
    sections: [
      {
        heading: 'New',
        notes: ['Create your account with a player name, email and password. Pick the name you want to be known by.'],
      },
      {
        heading: 'Fixed',
        notes: [
          'Fixed confirmation emails that could not be opened on a phone or in another browser. The link now works on any device.',
          'Added Forgot your password? to the sign-in screen.',
        ],
      },
    ],
  },
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
