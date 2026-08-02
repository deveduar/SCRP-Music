import type { QuickLink } from '../src/types/links'

export const MUSIC_LINKS: QuickLink[] = [
  {
    id: 'youtube_music',
    label: 'YouTube Music',
    url: (q) => `https://music.youtube.com/search?q=${encodeURIComponent(q)}`,
    icon: 'Music',
  },
  {
    id: 'spotify',
    label: 'Spotify',
    url: (q) => `https://open.spotify.com/search/${encodeURIComponent(q)}`,
    icon: 'Headphones',
  },
  {
    id: 'beatport',
    label: 'Beatport',
    url: (q) => `https://www.beatport.com/search?q=${encodeURIComponent(q)}`,
    icon: 'Sparkles',
  },
  {
    id: 'bandcamp',
    label: 'Bandcamp',
    url: (q) => `https://bandcamp.com/search?q=${encodeURIComponent(q)}`,
    icon: 'Music',
  },
  {
    id: 'discogs',
    label: 'Discogs',
    url: (q) => `https://www.discogs.com/search?q=${encodeURIComponent(q)}`,
    icon: 'DiscAlbum',
  },
  {
    id: 'soundcloud',
    label: 'SoundCloud',
    url: (q) => `https://soundcloud.com/search?q=${encodeURIComponent(q)}`,
    icon: 'Cloud',
  },
  {
    id: 'apple_music',
    label: 'Apple Music',
    url: (q) => `https://music.apple.com/search?term=${encodeURIComponent(q)}`,
    icon: 'Apple',
  },
  {
    id: 'traxsource',
    label: 'Traxsource',
    url: (q) => `https://www.traxsource.com/search?q=${encodeURIComponent(q)}`,
    icon: 'Search',
  },
  {
    id: 'juno',
    label: 'Juno Download',
    url: (q) => `https://www.junodownload.com/search/?q=${encodeURIComponent(q)}`,
    icon: 'Download',
  },
  {
    id: 'deezer',
    label: 'Deezer',
    url: (q) => `https://www.deezer.com/search/${encodeURIComponent(q)}`,
    icon: 'Music',
  },
  {
    id: 'tidal',
    label: 'Tidal',
    url: (q) => `https://tidal.com/search?q=${encodeURIComponent(q)}`,
    icon: 'Music',
  },
  {
    id: 'boomkat',
    label: 'Boomkat',
    url: (q) => `https://boomkat.com/search?q=${encodeURIComponent(q)}`,
    icon: 'Music',
  },
  {
    id: 'ra',
    label: 'Resident Advisor',
    url: (q) => `https://ra.co/search?q=${encodeURIComponent(q)}`,
    icon: 'Radio',
  },
  {
    id: 'rym',
    label: 'RateYourMusic',
    url: (q) => `https://rateyourmusic.com/search?searchterm=${encodeURIComponent(q)}&searchtype=l`,
    icon: 'Star',
  },
]
