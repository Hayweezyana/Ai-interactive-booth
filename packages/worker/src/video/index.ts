import type { VideoProvider } from '@shared/video/provider'
import { videoGen } from './bananaProvider'

export function getVideoProvider(name?: string): VideoProvider {
  switch (name) {
    case 'banana':
    default:
      return videoGen as unknown as VideoProvider
  }
}
