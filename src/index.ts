#!/usr/bin/env node
import { render } from "ink";
import React from "react";
import { App } from "./tui/App.js";

render(React.createElement(App));
