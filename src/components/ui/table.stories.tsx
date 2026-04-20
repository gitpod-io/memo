import type { Meta, StoryObj } from "@storybook/react";
import { Badge } from "./badge";
import {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
} from "./table";

const meta: Meta<typeof Table> = {
  title: "UI/Table",
  component: Table,
};

export { meta as default };

type Story = StoryObj<typeof Table>;

export const Default: Story = {
  render: () => (
    <div className="w-[500px]">
      <Table>
        <TableCaption>Recent pages</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead>Title</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Updated</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell>Getting Started</TableCell>
            <TableCell>
              <Badge variant="default">Published</Badge>
            </TableCell>
            <TableCell>2 hours ago</TableCell>
          </TableRow>
          <TableRow>
            <TableCell>API Reference</TableCell>
            <TableCell>
              <Badge variant="secondary">Draft</Badge>
            </TableCell>
            <TableCell>1 day ago</TableCell>
          </TableRow>
          <TableRow>
            <TableCell>Changelog</TableCell>
            <TableCell>
              <Badge variant="outline">Archived</Badge>
            </TableCell>
            <TableCell>3 days ago</TableCell>
          </TableRow>
        </TableBody>
        <TableFooter>
          <TableRow>
            <TableCell colSpan={3}>3 pages total</TableCell>
          </TableRow>
        </TableFooter>
      </Table>
    </div>
  ),
};
