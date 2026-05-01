"use client";

import { Plus } from "lucide-react";
import type { PropertyType } from "@/lib/types";
import { PROPERTY_TYPE_ICON, PROPERTY_TYPE_LABEL } from "@/lib/property-icons";
import {
  STANDARD_PROPERTY_TYPES,
  ADVANCED_PROPERTY_TYPES,
} from "@/components/database/property-types";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface PropertyTypePickerProps {
  /** Called when a property type is selected. */
  onSelect: (type: PropertyType) => void;
}

export function PropertyTypePicker({ onSelect }: PropertyTypePickerProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="flex h-full items-center text-muted-foreground hover:text-foreground"
        aria-label="Add column"
        data-testid="property-type-picker-trigger"
      >
        <Plus className="h-3.5 w-3.5" />
      </DropdownMenuTrigger>
      <DropdownMenuContent side="bottom" align="start" className="w-48" data-testid="property-type-picker-menu">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Property type</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {STANDARD_PROPERTY_TYPES.map((type) => {
            const Icon = PROPERTY_TYPE_ICON[type];
            return (
              <DropdownMenuItem key={type} onClick={() => onSelect(type)} data-testid={`property-type-option-${type}`}>
                <Icon className="h-4 w-4 text-muted-foreground" />
                {PROPERTY_TYPE_LABEL[type]}
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuLabel>Advanced</DropdownMenuLabel>
          {ADVANCED_PROPERTY_TYPES.map((type) => {
            const Icon = PROPERTY_TYPE_ICON[type];
            return (
              <DropdownMenuItem key={type} onClick={() => onSelect(type)} data-testid={`property-type-option-${type}`}>
                <Icon className="h-4 w-4 text-muted-foreground" />
                {PROPERTY_TYPE_LABEL[type]}
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
