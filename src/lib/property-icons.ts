// Shared mapping from PropertyType to lucide-react icon component and label.
// Extracted so multiple database components can reuse it.

import {
  Calendar,
  CheckSquare,
  Clock,
  FileText,
  Hash,
  Link as LinkIcon,
  List,
  Mail,
  Phone,
  Type,
  User,
  Users,
} from "lucide-react";
import type { PropertyType } from "@/lib/types";

export const PROPERTY_TYPE_ICON: Record<
  PropertyType,
  React.ComponentType<{ className?: string }>
> = {
  text: Type,
  number: Hash,
  select: List,
  multi_select: List,
  checkbox: CheckSquare,
  date: Calendar,
  url: LinkIcon,
  email: Mail,
  phone: Phone,
  person: User,
  files: FileText,
  relation: LinkIcon,
  formula: Hash,
  created_time: Clock,
  updated_time: Clock,
  created_by: Users,
};

export const PROPERTY_TYPE_LABEL: Record<PropertyType, string> = {
  text: "Text",
  number: "Number",
  select: "Select",
  multi_select: "Multi-select",
  checkbox: "Checkbox",
  date: "Date",
  url: "URL",
  email: "Email",
  phone: "Phone",
  person: "Person",
  files: "Files",
  relation: "Relation",
  formula: "Formula",
  created_time: "Created time",
  updated_time: "Updated time",
  created_by: "Created by",
};
