import type Queue = require('bee-queue');
import { Sequelize } from 'sequelize-typescript';

export function process(queue: Queue, sequelize: Sequelize) {
  queue.process((job) => {
    // TODO
  });
}
