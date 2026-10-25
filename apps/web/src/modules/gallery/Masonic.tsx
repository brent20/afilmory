// @copy internal masonic hooks
import { useScrollViewElement } from '@afilmory/ui'
import { clearRequestTimeout, requestTimeout } from '@essentials/request-timeout'
import { useWindowSize } from '@react-hook/window-size'
import { isEqual, throttle } from 'es-toolkit/compat'
import type {
  ContainerPosition,
  MasonryProps,
  MasonryScrollerProps,
  Positioner,
  UsePositionerOptions,
} from 'masonic'
import { createPositioner, createResizeObserver, useMasonry, useScrollToIndex } from 'masonic'
import { useForceUpdate } from 'motion/react'
import * as React from 'react'

export interface MasonryRef {
  reposition: () => void
}
/**
 * A "batteries included" masonry grid which includes all of the implementation details below. This component is the
 * easiest way to get off and running in your app, before switching to more advanced implementations, if necessary.
 * It will change its column count to fit its container's width and will decide how many rows to render based upon
 * the height of the browser `window`.
 *
 * @param props
 */
export const Masonry = <Item,>(props: MasonryProps<Item> & { ref?: React.Ref<MasonryRef> }) => {
  const [scrollTop, setScrollTop] = React.useState(0)
  const [isScrolling, setIsScrolling] = React.useState(false)
  const scrollElement = useScrollViewElement()

  const fps = props.scrollFps || 12
  React.useEffect(() => {
    if (!scrollElement) return

    const scrollTimer: number | null = null
    const handleScroll = throttle(() => {
      setIsScrolling(true)
      setScrollTop(scrollElement.scrollTop)
    }, 1000 / fps)

    scrollElement.addEventListener('scroll', handleScroll)

    return () => {
      scrollElement.removeEventListener('scroll', handleScroll)
      if (scrollTimer) {
        clearTimeout(scrollTimer)
      }
    }
  }, [fps, scrollElement])
  const didMount = React.useRef(0)
  React.useEffect(() => {
    if (didMount.current === 1) setIsScrolling(true)
    let didUnsubscribe = false
    const to = requestTimeout(
      () => {
        if (didUnsubscribe) return
        // This is here to prevent premature bail outs while maintaining high resolution
        // unsets. Without it there will always bee a lot of unnecessary DOM writes to style.
        setIsScrolling(false)
      },
      40 + 1000 / fps,
    )
    didMount.current = 1
    return () => {
      didUnsubscribe = true
      clearRequestTimeout(to)
    }
  }, [fps, scrollTop])

  const containerRef = React.useRef<null | HTMLElement>(null)
  const windowSize = useWindowSize({
    initialWidth: props.ssrWidth,
    initialHeight: props.ssrHeight,
  })
  const containerPos = useContainerPosition(containerRef, windowSize)

  const nextProps = Object.assign(
    {
      offset: containerPos.offset,
      width: containerPos.width || windowSize[0],
      height: containerPos.height || windowSize[1],
      containerRef,
    },
    props,
  ) as any

  const [positionIndex, setPositionIndex] = React.useState(0)

  React.useImperativeHandle(props.ref, () => ({
    reposition: () => {
      setPositionIndex((i) => i + 1)
    },
  }))

  // Workaround for https://github.com/jaredLunde/masonic/issues/12
  // masonic caches each item's position by *index*. That's fine when items are only
  // appended (e.g. "Show more"), but when a filter/collection/sort changes the list,
  // the same index now holds a different photo with a different height, so the stale
  // cached positions leave gaps and uneven columns. Reset the positioner whenever the
  // list is anything other than an append-only extension of the previous list.
  const prevItemsRef = React.useRef<typeof props.items>(props.items)
  const prevKeysRef = React.useRef<Array<string | number>>([])
  const layoutVersionRef = React.useRef(0)

  if (prevItemsRef.current !== props.items || prevKeysRef.current.length === 0) {
    const nextKeys = props.items.map((item, i) => props.itemKey?.(item, i) ?? i)
    const prevKeys = prevKeysRef.current
    const isAppendOnly = nextKeys.length >= prevKeys.length && prevKeys.every((key, i) => key === nextKeys[i])

    if (!isAppendOnly) layoutVersionRef.current += 1

    prevItemsRef.current = props.items
    prevKeysRef.current = nextKeys
  }

  nextProps.positioner = useSafePositioner(nextProps, [layoutVersionRef.current, positionIndex], props.items.length)

  nextProps.resizeObserver = useResizeObserver(nextProps.positioner)
  nextProps.scrollTop = scrollTop
  nextProps.isScrolling = isScrolling
  nextProps.height = window.innerHeight

  const scrollToIndex = useScrollToIndex(nextProps.positioner, {
    height: nextProps.height,
    offset: containerPos.offset,
    align: typeof props.scrollToIndex === 'object' ? props.scrollToIndex.align : void 0,
    element: scrollElement ?? undefined,
  })
  const index =
    props.scrollToIndex && (typeof props.scrollToIndex === 'number' ? props.scrollToIndex : props.scrollToIndex.index)

  React.useEffect(() => {
    if (index !== void 0) scrollToIndex(index)
  }, [index, scrollToIndex])

  return <MasonryScroller {...nextProps} />
}

function MasonryScroller<Item>(
  props: MasonryScrollerProps<Item> & {
    scrollTop: number
    isScrolling: boolean
  },
) {
  // We put this in its own layer because it's the thing that will trigger the most updates
  // and we don't want to slower ourselves by cycling through all the functions, objects, and effects
  // of other hooks
  // const { scrollTop, isScrolling } = useScroller(props.offset, props.scrollFps)
  // This is an update-heavy phase and while we could just Object.assign here,
  // it is way faster to inline and there's a relatively low hit to he bundle
  // size.

  return useMasonry<Item>({
    scrollTop: props.scrollTop,
    isScrolling: props.isScrolling,
    positioner: props.positioner,
    resizeObserver: props.resizeObserver,
    items: props.items,
    onRender: props.onRender,
    as: props.as,
    id: props.id,
    className: props.className,
    style: props.style,
    role: props.role,
    tabIndex: props.tabIndex,
    containerRef: props.containerRef,
    itemAs: props.itemAs,
    itemStyle: props.itemStyle,
    itemHeightEstimate: props.itemHeightEstimate,
    itemKey: props.itemKey,
    overscanBy: props.overscanBy,
    height: props.height,
    render: props.render,
  })
}

function useContainerPosition(
  elementRef: React.MutableRefObject<HTMLElement | null>,
  deps: React.DependencyList = [],
): ContainerPosition & {
  height: number
} {
  const [containerPosition, setContainerPosition] = React.useState<
    ContainerPosition & {
      height: number
    }
  >({
    offset: 0,
    width: 0,
    height: 0,
  })

  React.useLayoutEffect(() => {
    const { current } = elementRef
    if (current !== null) {
      let offset = 0
      let el = current

      do {
        offset += el.offsetTop || 0
        el = el.offsetParent as HTMLElement
      } while (el)

      if (offset !== containerPosition.offset || current.offsetWidth !== containerPosition.width) {
        setContainerPosition({
          offset,
          width: current.offsetWidth,
          height: current.offsetHeight,
        })
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  React.useEffect(() => {
    const resizeObserver = new ResizeObserver(() => {
      setContainerPosition((prev) => {
        const next = {
          ...prev,
          width: elementRef.current?.offsetWidth || 0,
        }
        if (isEqual(next, prev)) return prev
        return next
      })
    })
    resizeObserver.observe(elementRef.current as HTMLElement)
    return () => {
      resizeObserver.disconnect()
    }
  }, [containerPosition, elementRef])

  return containerPosition
}

/** Same column maths as masonic's own (unexported) getColumns. */
function getColumns(
  width = 0,
  minimumWidth = 0,
  gutter = 8,
  columnCount?: number,
  maxColumnCount?: number,
  maxColumnWidth?: number,
): [number, number] {
  const count = columnCount || Math.min(Math.floor((width + gutter) / (minimumWidth + gutter)), maxColumnCount || Infinity) || 1
  let computedWidth = Math.floor((width - gutter * (count - 1)) / count)
  if (maxColumnWidth !== undefined && computedWidth > maxColumnWidth) computedWidth = maxColumnWidth
  return [computedWidth, count]
}

/**
 * Replacement for masonic's usePositioner(). The original, whenever the grid is resized, copies every
 * cached position from the old positioner into the new one. If the photo list got shorter at the same
 * time (opening /?tags=Birds shrinks the list from a full first batch down to just the Birds), the copy
 * carries positions for photos that no longer exist, masonic then asks for items[i] past the end of the
 * list, and the page crashes with "Cannot read properties of undefined (reading 'id')".
 *
 * This version never keeps more cached positions than there are photos, and it only carries cached
 * heights over for a plain resize (not when the list itself changed).
 */
function useSafePositioner(
  { width, columnWidth = 200, columnGutter = 0, rowGutter, columnCount, maxColumnCount, maxColumnWidth }: UsePositionerOptions,
  deps: React.DependencyList,
  itemCount: number,
): Positioner {
  const initPositioner = (): Positioner => {
    const [computedColumnWidth, computedColumnCount] = getColumns(
      width,
      columnWidth,
      columnGutter,
      columnCount,
      maxColumnCount,
      maxColumnWidth,
    )
    return createPositioner(computedColumnCount, computedColumnWidth, columnGutter, rowGutter ?? columnGutter)
  }

  const positionerRef = React.useRef<Positioner | undefined>(undefined)
  if (positionerRef.current === undefined) positionerRef.current = initPositioner()

  const prevDeps = React.useRef(deps)
  const opts = [width, columnWidth, columnGutter, rowGutter, columnCount, maxColumnCount, maxColumnWidth]
  const prevOpts = React.useRef(opts)

  const optsChanged = !opts.every((item, i) => prevOpts.current[i] === item)
  const depsChanged = deps.length !== prevDeps.current.length || !deps.every((item, i) => prevDeps.current[i] === item)
  // Safety net: a positioner that knows about more photos than the list has must never be used.
  const hasStalePositions = positionerRef.current.size() > itemCount

  if (optsChanged || depsChanged || hasStalePositions) {
    const prevPositioner = positionerRef.current
    const positioner = initPositioner()
    prevDeps.current = deps
    prevOpts.current = opts

    if (optsChanged && !depsChanged && !hasStalePositions) {
      const cacheSize = Math.min(prevPositioner.size(), itemCount)
      for (let index = 0; index < cacheSize; index++) {
        const pos = prevPositioner.get(index)
        positioner.set(index, pos === undefined ? 0 : pos.height)
      }
    }

    positionerRef.current = positioner
  }

  return positionerRef.current
}

function useResizeObserver(positioner: Positioner) {
  const [forceUpdate] = useForceUpdate()
  const resizeObserver = createResizeObserver(positioner, throttle(forceUpdate, 1000 / 12))
  // Cleans up the resize observers when they change or the
  // component unmounts
  React.useEffect(() => () => resizeObserver.disconnect(), [resizeObserver])
  return resizeObserver
}