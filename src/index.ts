#!/usr/bin/env node

import { program } from 'commander';
import { promises as fs } from 'fs';
import path from 'path';
import glob from 'glob';
import ignore from 'ignore';

async function aggregateFiles(outputFile: string): Promise<void> {
  try {
    // TODO: Implement file aggregation logic
    console.log(`Aggregating files to ${outputFile}`);
  } catch (error) {
    console.error('Error aggregating files:', error);
    process.exit(1);
  }
}

program
  .version('1.0.0')
  .description('Aggregate files into a single Markdown file')
  .option('-o, --output <file>', 'Output file name', 'codebase.md')
  .action(async (options) => {
    await aggregateFiles(options.output);
  });

program.parse(process.argv);
