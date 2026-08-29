import { useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { ChevronDown } from 'lucide-react-native';

import { ABBREVIATION_OPTIONS_BY_TYPE } from '@/constants/scannerData';
import type { AbbreviationOption } from '@/types/scanner';
import { useScannerStore } from '@/store/scannerStore';

interface MenuPosition {
  top: number;
  left: number;
  width: number;
}

interface UndetectedAbbreviationModalProps {
  abbreviation: string;
  selectedOption: AbbreviationOption;
  onOptionChange: (option: AbbreviationOption) => void;
  onContinue: () => void;
}

export function UndetectedAbbreviationModal({
  abbreviation,
  selectedOption,
  onOptionChange,
  onContinue,
}: UndetectedAbbreviationModalProps) {
  const selectedType = useScannerStore((s) => s.selectedType);
  const abbreviationOptions = ABBREVIATION_OPTIONS_BY_TYPE[selectedType];
  const modalRef = useRef<View>(null);
  const triggerRef = useRef<View>(null);
  const [open, setOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState<MenuPosition | null>(null);

  const handleSelect = (option: AbbreviationOption) => {
    onOptionChange(option);
    setOpen(false);
  };

  const toggleDropdown = () => {
    if (open) {
      setOpen(false);
      return;
    }

    if (!modalRef.current || !triggerRef.current) {
      setOpen(true);
      return;
    }

    triggerRef.current.measureLayout(
      modalRef.current,
      (x, y, width, height) => {
        setMenuPosition({ top: y + height, left: x, width });
        setOpen(true);
      },
      () => setOpen(true),
    );
  };

  return (
    <View
      ref={modalRef}
      className="relative rounded-[20px] border-2 border-danger-text bg-white px-6 py-7 shadow-lg"
      style={{ overflow: 'visible' }}
    >
      <Text className="text-lg font-bold text-text-primary">Undetected Abbreviation</Text>
      <Text className="mt-2 text-sm leading-5 text-text-secondary">
        Please select correct Abbreviation for :
      </Text>

      <View className="mt-5 flex-row items-center gap-2">
        <View className="h-[46px] min-w-[76px] items-center justify-center rounded-input border border-border bg-white px-3">
          <Text className="text-sm font-medium text-text-secondary">{abbreviation}</Text>
        </View>

        <View ref={triggerRef} className="h-[46px] flex-1 flex-row overflow-hidden rounded-input border border-border bg-white">
          <Pressable className="flex-1 justify-center px-3" onPress={toggleDropdown}>
            <Text className="text-sm font-medium text-text-primary">{selectedOption}</Text>
          </Pressable>
          <Pressable className="w-11 items-center justify-center bg-primary" onPress={toggleDropdown}>
            <ChevronDown
              size={18}
              color="#FFFFFF"
              style={{ transform: [{ rotate: open ? '180deg' : '0deg' }] }}
            />
          </Pressable>
        </View>
      </View>

      <Pressable
        onPress={onContinue}
        className="mt-6 items-center rounded-button bg-primary py-3.5 active:opacity-90"
      >
        <Text className="text-sm font-semibold text-white">Continue</Text>
      </Pressable>

      {open && menuPosition ? (
        <View
          className="absolute overflow-hidden rounded-b-input border border-border bg-white shadow-lg"
          style={{
            top: menuPosition.top,
            left: menuPosition.left,
            width: menuPosition.width,
            zIndex: 100,
            elevation: 12,
          }}
        >
          {abbreviationOptions.map((option, index) => {
            const isSelected = selectedOption === option;
            return (
              <Pressable
                key={option}
                onPress={() => handleSelect(option)}
                className={`px-3 py-3 ${index > 0 ? 'border-t border-border' : ''} ${
                  isSelected ? 'bg-primary' : 'bg-white'
                }`}
              >
                <Text
                  className={`text-sm ${
                    isSelected ? 'font-semibold text-white' : 'text-text-primary'
                  }`}
                >
                  {option}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}
