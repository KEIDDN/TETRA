import type { SkinId } from '../game/skins';

/** Where a track can be used: the menus or a skin's scene. */
export type MusicSlot = 'menu' | SkinId;

export interface Track {
  id: string;
  title: string;
  artist: string;
  album: string;
  /** Human-readable license, e.g. "CC BY-NC-SA 4.0". */
  license: string;
  licenseUrl: string;
  /** No-derivatives: always played whole and unmodified (looped from the top, faded only at transitions). */
  nd: boolean;
  /** Where the track and its license live. */
  source: string;
  /** Hosted with the game (normalised to −14 LUFS) or streamed from the Internet Archive (CORS, so the analyser can listen). */
  url: string;
  /** Seconds. */
  duration: number;
  /** Beats per minute when the track has a clear pulse (estimated offline); null for beatless ambient. */
  bpm: number | null;
  mood: string;
  /** The slot the shortlist suggested; the Music lab decides. */
  suggest: MusicSlot;
}

/**
 * The soundtrack: the owner's Pixabay selection (hosted with the game,
 * normalised to −14 LUFS), the Monofónicos tracks that set the tone, and
 * deep ambient for the menu. Formerly the shortlist: immersive minimal techno for the game (ambient, dub and deep
 * techno, a touch of hard groove) and very ambient minimal IDM for the menu,
 * from netlabels on the Internet Archive. Licenses checked per release;
 * pre-sorted into slots by measured tempo, kick steadiness, density and
 * brightness.
 */
export const TRACKS: Track[] = [
{ id: "dsum-morris-solar", title: "Solar", artist: "Dsum & Morris", album: "Arium FL", license: "CC BY-SA 3.0", licenseUrl: "https://creativecommons.org/licenses/by-sa/3.0/", nd: false, source: "https://archive.org/details/MNF023_Dsum_Morris--Arium_FL", url: "https://archive.org/download/MNF023_Dsum_Morris--Arium_FL/01_Dsum_Morris_-_Solar.mp3", duration: 814, bpm: null, mood: "ambient", suggest: "menu" },
  { id: "migloje-ammbissio-flat", title: "Ammbissio Flat", artist: "MigloJE", album: "Linear Emotions", license: "CC BY-NC-ND 3.0", licenseUrl: "https://creativecommons.org/licenses/by-nc-nd/3.0/", nd: true, source: "https://archive.org/details/MigloJE-Linear_Emotions", url: "https://archive.org/download/MigloJE-Linear_Emotions/kahvi163g_migloJE_ammbisso_flat.mp3", duration: 482, bpm: null, mood: "ambient", suggest: "menu" },
  { id: "migloje-nashtee", title: "Nashtee", artist: "MigloJE", album: "Linear Emotions", license: "CC BY-NC-ND 3.0", licenseUrl: "https://creativecommons.org/licenses/by-nc-nd/3.0/", nd: true, source: "https://archive.org/details/MigloJE-Linear_Emotions", url: "https://archive.org/download/MigloJE-Linear_Emotions/kahvi163f_migloJE_nashtee.mp3", duration: 281, bpm: 113.5, mood: "ambient", suggest: "menu" },
  { id: "muhr-anomalies", title: "Anomalies", artist: "Muhr", album: "Lullabies", license: "CC BY-ND 3.0", licenseUrl: "https://creativecommons.org/licenses/by-nd/3.0/", nd: true, source: "https://archive.org/details/kahvi195_Muhr_lullabies", url: "https://archive.org/download/kahvi195_Muhr_lullabies/kahvi195c_muhr-anomalies.mp3", duration: 279, bpm: null, mood: "ambient", suggest: "menu" },
  { id: "fractal-philosophy-home", title: "Home", artist: "Fractal Philosophy", album: "Ambientium", license: "CC BY-ND 3.0", licenseUrl: "https://creativecommons.org/licenses/by-nd/3.0/", nd: true, source: "https://archive.org/details/kahvi265_FP_Ambientium", url: "https://archive.org/download/kahvi265_FP_Ambientium/kahvi265i_ambientium-home.mp3", duration: 414, bpm: 120.0, mood: "ambient", suggest: "menu" },
  { id: "callejas-p-ramo-1", title: "Páramo 1", artist: "Callejas", album: "Páramo", license: "CC BY-SA 4.0", licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/", nd: false, source: "https://archive.org/details/MNF041_Callejas--Paramo", url: "https://archive.org/download/MNF041_Callejas--Paramo/01_Callejas_-_P%C3%A1ramo_1.mp3", duration: 325, bpm: 124.0, mood: "hypnotic techno", suggest: "studio" },
  { id: "px-alex-morgan-ambient-techno", title: "Ambient Techno", artist: "Alex Morgan", album: "Pixabay", license: "Pixabay Content License", licenseUrl: "https://pixabay.com/service/license-summary/", nd: false, source: "https://pixabay.com/music/search/Ambient%20Techno%20Alex%20Morgan/", url: "/music/alex-morgan-ambient-techno.m4a", duration: 177, bpm: null, mood: "ambient techno", suggest: "menu" },
  { id: "px-desifreemusic-berlin-groove", title: "Berlin Style Techno Groove", artist: "DesiFreeMusic", album: "Pixabay", license: "Pixabay Content License", licenseUrl: "https://pixabay.com/service/license-summary/", nd: false, source: "https://pixabay.com/music/search/Berlin%20Style%20Techno%20Groove%20DesiFreeMusic/", url: "/music/desifreemusic-berlin-groove.m4a", duration: 192, bpm: null, mood: "hard groove", suggest: "bevel" },
  { id: "px-kamilala-diesel", title: "Diesel", artist: "Kamilala", album: "Pixabay", license: "Pixabay Content License", licenseUrl: "https://pixabay.com/service/license-summary/", nd: false, source: "https://pixabay.com/music/search/Diesel%20Kamilala/", url: "/music/kamilala-diesel.m4a", duration: 267, bpm: 128.0, mood: "raw techno", suggest: "ember" },
  { id: "px-mode-x-dopetronic-hyperdrive", title: "Hyperdrive", artist: "Mode-X & Dopetronic", album: "Pixabay", license: "Pixabay Content License", licenseUrl: "https://pixabay.com/service/license-summary/", nd: false, source: "https://pixabay.com/music/search/Hyperdrive%20Mode-X%20&%20Dopetronic/", url: "/music/mode-x-dopetronic-hyperdrive.m4a", duration: 382, bpm: 126.5, mood: "dark techno", suggest: "neon" },
  { id: "px-nick-panek-anomalies-of-the-dreamscape", title: "Anomalies of the Dreamscape (German Techno Remix)", artist: "Nick Panek", album: "Pixabay", license: "Pixabay Content License", licenseUrl: "https://pixabay.com/service/license-summary/", nd: false, source: "https://pixabay.com/music/search/Anomalies%20of%20the%20Dreamscape%20(German%20Techno%20Remix)%20Nick%20Panek/", url: "/music/nick-panek-anomalies-of-the-dreamscape.m4a", duration: 299, bpm: 124.0, mood: "hypnotic techno", suggest: "nes" },
  { id: "px-openmind-audio-driving-night-energy", title: "Driving Night Energy", artist: "OpenMind Audio", album: "Pixabay", license: "Pixabay Content License", licenseUrl: "https://pixabay.com/service/license-summary/", nd: false, source: "https://pixabay.com/music/search/Driving%20Night%20Energy%20OpenMind%20Audio/", url: "/music/openmind-audio-driving-night-energy.m4a", duration: 173, bpm: 124.0, mood: "melodic techno", suggest: "gem" },
  { id: "px-slimeyfox-deephouse-legends", title: "Deephouse Legends", artist: "SlimeyFox", album: "Pixabay", license: "Pixabay Content License", licenseUrl: "https://pixabay.com/service/license-summary/", nd: false, source: "https://pixabay.com/music/search/Deephouse%20Legends%20SlimeyFox/", url: "/music/slimeyfox-deephouse-legends.mp3", duration: 235, bpm: 125.0, mood: "deep house", suggest: "clay" },
  { id: "px-vjgalaxy-dark-melodic-techno-02", title: "Dark Melodic Techno 02", artist: "VJ Galaxy", album: "Pixabay", license: "Pixabay Content License", licenseUrl: "https://pixabay.com/service/license-summary/", nd: false, source: "https://pixabay.com/music/search/Dark%20Melodic%20Techno%2002%20VJ%20Galaxy/", url: "/music/vjgalaxy-dark-melodic-techno-02.m4a", duration: 242, bpm: 134.5, mood: "dark techno", suggest: "wire" },
  { id: "px-vladislav-zavorin-242", title: "242", artist: "Vladislav Zavorin", album: "Pixabay", license: "Pixabay Content License", licenseUrl: "https://pixabay.com/service/license-summary/", nd: false, source: "https://pixabay.com/music/search/242%20Vladislav%20Zavorin/", url: "/music/vladislav-zavorin-242.m4a", duration: 334, bpm: 126.5, mood: "dark techno", suggest: "mono" },
  { id: "px-vladislav-zavorin-ambient-techno", title: "Ambient Techno", artist: "Vladislav Zavorin", album: "Pixabay", license: "Pixabay Content License", licenseUrl: "https://pixabay.com/service/license-summary/", nd: false, source: "https://pixabay.com/music/search/Ambient%20Techno%20Vladislav%20Zavorin/", url: "/music/vladislav-zavorin-ambient-techno.m4a", duration: 334, bpm: 128.0, mood: "hypnotic techno", suggest: "aurora" },
  { id: "dcm-elevaci-n-alex-under-remix", title: "Elevación (Alex Under Remix)", artist: "DCM", album: "Elevación", license: "CC BY-SA 3.0", licenseUrl: "https://creativecommons.org/licenses/by-sa/3.0/", nd: false, source: "https://archive.org/details/MNF022_DCM--Elevacion", url: "https://archive.org/download/MNF022_DCM--Elevacion/09_DCM_-_Elevacion_Alex_Under_Remix.mp3", duration: 436, bpm: 124.0, mood: "hypnotic techno", suggest: "crystal" },
  { id: "dcm-elevaci-n-qk-low-pitch-remix", title: "Elevación (QK Low Pitch Remix)", artist: "DCM", album: "Elevación", license: "CC BY-SA 3.0", licenseUrl: "https://creativecommons.org/licenses/by-sa/3.0/", nd: false, source: "https://archive.org/details/MNF022_DCM--Elevacion", url: "https://archive.org/download/MNF022_DCM--Elevacion/06_DCM_-_Elevacion_QK_Low_Pitch_Remix.mp3", duration: 425, bpm: 124.0, mood: "hypnotic techno", suggest: "gameboy" },
];

export const TRACK_BY_ID: Record<string, Track> = Object.fromEntries(TRACKS.map((t) => [t.id, t]));
