import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import {
  Keyboard,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  TextInput,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ScrollViewProps,
} from 'react-native';
import { useFocusEffect } from 'expo-router';

/** Room left between the focused field and the top of the keyboard: just a little. */
const CLEARANCE = 16;

type Measurable = {
  measureInWindow: (callback: (x: number, y: number, width: number, height: number) => void) => void;
};

type FieldMeasurable = {
  measureLayout: (
    relativeTo: unknown,
    onSuccess: (x: number, y: number, width: number, height: number) => void,
    onFail: () => void,
  ) => void;
};

/**
 * A ScrollView that keeps the field being typed in above the keyboard — on
 * every form in the app, at the shop's asking.
 *
 * Android's own resize does not do it any more: with the app drawn edge to
 * edge the window is not shrunk for the keyboard, so a field low on the page
 * sat behind it. Here, when the keyboard opens — and whenever another field
 * takes focus while it is open — the focused input's place in the list is
 * measured, and if its bottom would sit behind the keyboard the list scrolls
 * just far enough to bring it a little above it. The content also gains bottom
 * room the height of the keyboard, so the last field on a page can rise
 * clear of it too.
 *
 * Only the screen in front reacts: screens left behind in the stack keep
 * their scroll position.
 */
export const KeyboardAwareScrollView = forwardRef<ScrollView, ScrollViewProps>(
  function KeyboardAwareScrollView(
    { contentContainerStyle, onScroll, scrollEventThrottle, keyboardShouldPersistTaps, children, ...rest },
    ref,
  ) {
    const scrollRef = useRef<ScrollView>(null);
    useImperativeHandle(ref, () => scrollRef.current as ScrollView, []);

    const offsetY = useRef(0);
    const keyboardTop = useRef<number | null>(null);
    const lastRevealed = useRef<unknown>(null);
    const focused = useRef(true);
    const [keyboardHeight, setKeyboardHeight] = useState(0);

    useFocusEffect(
      useCallback(() => {
        focused.current = true;
        return () => {
          focused.current = false;
        };
      }, []),
    );

    // The scroll is worked out as a place in the content, not a distance from
    // wherever the list happens to be: a distance added on top of Android's
    // own scroll to the field, or of a second keyboard event landing while
    // the first scroll was still moving, stacked up and carried the field
    // right up under the header. The same field always gives the same place.
    const reveal = useCallback(() => {
      const top = keyboardTop.current;
      const scroll = scrollRef.current;
      if (top === null || !focused.current || !scroll) return;
      const input = TextInput.State.currentlyFocusedInput?.() as unknown as FieldMeasurable | null;
      // In React Native's ScrollView (0.81) though not in its TypeScript types.
      const inner = (scroll as unknown as { getInnerViewRef?: () => unknown }).getInnerViewRef?.();
      if (!input || !inner || typeof input.measureLayout !== 'function') return;
      lastRevealed.current = input;
      // A field that is not in this list (one in a sheet over it) fails here
      // and moves nothing.
      input.measureLayout(
        inner,
        (_x, fieldTop, _width, fieldHeight) => {
          (scroll as unknown as Measurable).measureInWindow((_sx, listTop, _sw, listHeight) => {
            // Window measurements on Android start below the status bar; the
            // keyboard's top is given from the top of the screen.
            const keyboardTopInWindow =
              top - (Platform.OS === 'android' ? StatusBar.currentHeight ?? 0 : 0);
            const visibleBottom = Math.min(listTop + listHeight, keyboardTopInWindow);
            const target = fieldTop + fieldHeight + CLEARANCE - (visibleBottom - listTop);
            if (target > offsetY.current + 1) {
              scroll.scrollTo({ y: target, animated: true });
            }
          });
        },
        () => {},
      );
    }, []);

    useEffect(() => {
      const show = Keyboard.addListener('keyboardDidShow', (event) => {
        keyboardTop.current = event.endCoordinates.screenY;
        setKeyboardHeight(event.endCoordinates.height);
        // After the extra bottom room has been laid out.
        setTimeout(reveal, 80);
      });
      const hide = Keyboard.addListener('keyboardDidHide', () => {
        keyboardTop.current = null;
        lastRevealed.current = null;
        setKeyboardHeight(0);
      });
      // A field tapped while the keyboard is already up sends no keyboard
      // event, so the focused field is checked while the keyboard is open.
      const poll = setInterval(() => {
        if (keyboardTop.current === null) return;
        const input = TextInput.State.currentlyFocusedInput?.();
        if (input && input !== lastRevealed.current) reveal();
      }, 250);
      return () => {
        show.remove();
        hide.remove();
        clearInterval(poll);
      };
    }, [reveal]);

    const handleScroll = useCallback(
      (event: NativeSyntheticEvent<NativeScrollEvent>) => {
        offsetY.current = event.nativeEvent.contentOffset.y;
        onScroll?.(event);
      },
      [onScroll],
    );

    const flat = StyleSheet.flatten(contentContainerStyle) ?? {};
    const basePadding =
      typeof flat.paddingBottom === 'number'
        ? flat.paddingBottom
        : typeof flat.paddingVertical === 'number'
          ? flat.paddingVertical
          : typeof flat.padding === 'number'
            ? flat.padding
            : 0;

    return (
      <ScrollView
        ref={scrollRef}
        {...rest}
        onScroll={handleScroll}
        scrollEventThrottle={scrollEventThrottle ?? 16}
        keyboardShouldPersistTaps={keyboardShouldPersistTaps ?? 'handled'}
        contentContainerStyle={[
          contentContainerStyle,
          keyboardHeight > 0 ? { paddingBottom: basePadding + keyboardHeight } : null,
        ]}
      >
        {children}
      </ScrollView>
    );
  },
);
