const path = require('path');
const fs = require('fs');
const { open } = require('../db');
const { createApp } = require('../server');

const app = createApp(open());

module.exports = app;
