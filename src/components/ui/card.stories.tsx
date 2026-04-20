import type { Meta, StoryObj } from "@storybook/react";
import { Button } from "./button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardAction,
  CardContent,
  CardFooter,
} from "./card";

const meta: Meta<typeof Card> = {
  title: "UI/Card",
  component: Card,
};

export { meta as default };

type Story = StoryObj<typeof Card>;

export const Default: Story = {
  render: () => (
    <Card className="w-80">
      <CardHeader>
        <CardTitle>Card Title</CardTitle>
        <CardDescription>Card description goes here.</CardDescription>
      </CardHeader>
      <CardContent>
        <p>Card content with some text.</p>
      </CardContent>
    </Card>
  ),
};

export const WithFooter: Story = {
  render: () => (
    <Card className="w-80">
      <CardHeader>
        <CardTitle>Settings</CardTitle>
        <CardDescription>Manage your preferences.</CardDescription>
      </CardHeader>
      <CardContent>
        <p>Content area for settings controls.</p>
      </CardContent>
      <CardFooter>
        <Button size="sm">Save</Button>
      </CardFooter>
    </Card>
  ),
};

export const WithAction: Story = {
  render: () => (
    <Card className="w-80">
      <CardHeader>
        <CardTitle>Notifications</CardTitle>
        <CardDescription>Configure how you receive alerts.</CardDescription>
        <CardAction>
          <Button variant="outline" size="sm">
            Edit
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        <p>You have 3 unread notifications.</p>
      </CardContent>
    </Card>
  ),
};

export const Small: Story = {
  render: () => (
    <Card className="w-80" size="sm">
      <CardHeader>
        <CardTitle>Compact Card</CardTitle>
        <CardDescription>Smaller padding variant.</CardDescription>
      </CardHeader>
      <CardContent>
        <p>Compact content area.</p>
      </CardContent>
    </Card>
  ),
};
