import DefaultTheme from 'vitepress/theme'
import { nextTick, onMounted, watch } from 'vue'
import { useRoute } from 'vitepress'
import './custom.css'

export default {
  extends: DefaultTheme,
  setup() {
    const route = useRoute()

    const initImageZoom = async () => {
      const mediumZoom = await import('medium-zoom')

      mediumZoom.default('.vp-doc .screenshot-grid img, .vp-doc p > img:not(.no-zoom)', {
        background: 'rgba(15, 23, 42, 0.82)',
        margin: 32,
      })
    }

    onMounted(() => {
      void initImageZoom()

      watch(
        () => route.path,
        () => nextTick(() => void initImageZoom())
      )
    })
  },
}
