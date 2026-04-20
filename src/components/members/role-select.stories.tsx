import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { RoleSelect } from "./role-select";
import type { MemberRole } from "@/lib/types";

const meta: Meta<typeof RoleSelect> = {
  title: "Members/RoleSelect",
  component: RoleSelect,
};

export { meta as default };

type Story = StoryObj<typeof RoleSelect>;

function RoleSelectDemo({
  initial = "member",
  includeOwner = false,
}: {
  initial?: MemberRole;
  includeOwner?: boolean;
}) {
  const [role, setRole] = useState<MemberRole>(initial);
  return (
    <RoleSelect value={role} onChange={setRole} includeOwner={includeOwner} />
  );
}

export const Default: Story = {
  render: () => <RoleSelectDemo />,
};

export const WithOwnerOption: Story = {
  render: () => <RoleSelectDemo includeOwner initial="admin" />,
};
