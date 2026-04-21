"use client";

import type { JSX } from "react";
import {
  AutoLinkPlugin,
  createLinkMatcherWithRegExp,
} from "@lexical/react/LexicalAutoLinkPlugin";

const URL_REGEX =
  /((https?:\/\/(www\.)?)|(www\.))[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_+.~#?&/=]*[-a-zA-Z0-9()@:%_+~#?&/=])?/;

const EMAIL_REGEX =
  /(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))/;

const URL_MATCHER = createLinkMatcherWithRegExp(URL_REGEX, (text) =>
  text.startsWith("http") ? text : `https://${text}`,
);

const EMAIL_MATCHER = createLinkMatcherWithRegExp(
  EMAIL_REGEX,
  (text) => `mailto:${text}`,
);

const MATCHERS = [URL_MATCHER, EMAIL_MATCHER];

export function EditorAutoLinkPlugin(): JSX.Element | null {
  return <AutoLinkPlugin matchers={MATCHERS} />;
}
