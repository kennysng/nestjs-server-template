import { BodyParserMiddleware } from './body.middleware';
import { LogMiddleware } from './log.middleware';

export default [LogMiddleware, BodyParserMiddleware];
