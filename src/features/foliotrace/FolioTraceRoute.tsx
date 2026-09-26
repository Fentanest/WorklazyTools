import { useCallback, useEffect, useState } from 'react'
import { useAppLanguage } from '../../i18n/routing'
import { setAdIneligible } from '../../app/adEligibility'
import type { FolioTraceView } from './contracts'
import { loadFolioTraceSnapshot } from './data/loadSnapshot'
import { FolioTracePage } from './ui/FolioTracePage'

export function FolioTraceRoute() {
  const lang = useAppLanguage()
  const [view, setView] = useState<FolioTraceView>({ status: 'loading' })
  const [reload, setReload] = useState(0)
  const onRefresh = useCallback(() => setReload(value => value + 1), [])

  useEffect(() => {
    const controller = new AbortController()
    setView({ status: 'loading' })
    void loadFolioTraceSnapshot(controller.signal).then(setView).catch(error => {
      if (!(error instanceof DOMException && error.name === 'AbortError')) setView({ status: 'load-error' })
    })
    return () => controller.abort()
  }, [reload])

  useEffect(() => {
    setAdIneligible('folioTraceUnpublished', view.status !== 'ready')
    return () => setAdIneligible('folioTraceUnpublished', false)
  }, [view.status])

  return <FolioTracePage lang={lang} view={view} onRefresh={onRefresh} />
}
