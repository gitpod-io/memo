// Shared mapping from PropertyType to lucide-react icon component.
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
