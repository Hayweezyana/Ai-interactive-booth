import type { VideoProvider } from '@shared/video/provider'
import { bananaProvider } from './bananaProvider'

export function getVideoProvider(name?: string): VideoProvider {
  switch (name) {
    case 'banana':
    default:
      return bananaProvider
  }
}
