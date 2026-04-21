import strokeMatches, { StrokeMatchResultMeta } from './strokeMatches';
import UserStroke from './models/UserStroke';
import Positioner from './Positioner';
import { counter, colorStringToVals, fixIndex } from './utils';
import * as quizActions from './quizActions';
import * as geometry from './geometry';
import * as characterActions from './characterActions';
import Character from './models/Character';
import {
  ParsedHanziWriterOptions,
  Point,
  QuizLogEvent,
  QuizLogEventInput,
  QuizOptionsForLog,
  StrokeData,
} from './typings/types';
import RenderState from './RenderState';
import { GenericMutation } from './Mutation';

const getDrawnPath = (userStroke: UserStroke) => ({
  pathString: geometry.getPathString(userStroke.externalPoints),
  points: userStroke.points.map((point) => geometry.round(point)),
});

export default class Quiz {
  _character: Character;
  _renderState: RenderState;
  _isActive: boolean;
  _positioner: Positioner;

  /** Set on startQuiz */
  _options: ParsedHanziWriterOptions | undefined;
  _currentStrokeIndex = 0;
  _mistakesOnStroke = 0;
  _totalMistakes = 0;
  _userStroke: UserStroke | undefined;
  _userStrokesIds: Array<number> | undefined;

  _events: QuizLogEvent[] = [];
  _quizStartTime = 0;
  _nextSeq = 0;

  constructor(character: Character, renderState: RenderState, positioner: Positioner) {
    this._character = character;
    this._renderState = renderState;
    this._isActive = false;
    this._positioner = positioner;
  }

  startQuiz(options: ParsedHanziWriterOptions) {
    if (this._userStrokesIds) {
      this._renderState.run(
        quizActions.removeAllUserStrokes( this._userStrokesIds ),
      );
    }
    this._userStrokesIds = []

    this._isActive = true;
    this._options = options;
    const startIndex = fixIndex(
      options.quizStartStrokeNum,
      this._character.strokes.length,
    );
    this._currentStrokeIndex = Math.min(startIndex, this._character.strokes.length - 1);
    this._mistakesOnStroke = 0;
    this._totalMistakes = 0;

    this._events = [];
    this._quizStartTime = performance.now();
    this._nextSeq = 0;
    this._appendEvent({
      type: 'QuizStarted',
      character: this._character.symbol,
      options: this._quizOptionsForLog(options),
    });

    return this._renderState.run(
      quizActions.startQuiz(
        this._character,
        options.strokeFadeDuration,
        this._currentStrokeIndex,
      ),
    );
  }

  startUserStroke(externalPoint: Point) {
    if (!this._isActive) {
      return null;
    }
    if (this._userStroke) {
      return this.endUserStroke();
    }
    const point = this._positioner.convertExternalPoint(externalPoint);
    const strokeId = counter();
    this._userStroke = new UserStroke(strokeId, point, externalPoint);
    this._userStrokesIds?.push(strokeId);
    this._appendEvent({
      type: 'DrawingStarted',
      strokeNum: this._currentStrokeIndex,
    });
    return this._renderState.run(quizActions.startUserStroke(strokeId, point));
  }

  continueUserStroke(externalPoint: Point) {
    if (!this._userStroke) {
      return Promise.resolve();
    }
    const point = this._positioner.convertExternalPoint(externalPoint);
    this._userStroke.appendPoint(point, externalPoint);
    const nextPoints = this._userStroke.points.slice(0);
    return this._renderState.run(
      quizActions.updateUserStroke(this._userStroke.id, nextPoints),
    );
  }

  setPositioner(positioner: Positioner) {
    this._positioner = positioner;
  }

  endUserStroke() {
    if (!this._userStroke) return;

    this._renderState.run(
      quizActions.hideUserStroke(
        this._userStroke.id,
        this._options!.drawingFadeDuration ?? 300,
      ),
    );

    // skip single-point strokes
    if (this._userStroke.points.length === 1) {
      this._appendEvent({
        type: 'StrokeIgnoredTooShort',
        strokeNum: this._currentStrokeIndex,
      });
      this._userStroke = undefined;
      return;
    }

    const { acceptBackwardsStrokes, markStrokeCorrectAfterMisses } = this._options!;

    const currentStroke = this._getCurrentStroke();
    const { isMatch, meta } = strokeMatches(
      this._userStroke,
      this._character,
      this._currentStrokeIndex,
      {
        isOutlineVisible: this._renderState.state.character.outline.opacity > 0,
        leniency: this._options!.leniency,
        averageDistanceThreshold: this._options!.averageDistanceThreshold,
      },
    );

    // if markStrokeCorrectAfterMisses is passed, just force the stroke to count as correct after n tries
    const isForceAccepted =
      markStrokeCorrectAfterMisses &&
      this._mistakesOnStroke + 1 >= markStrokeCorrectAfterMisses;

    const isAccepted =
      isMatch || isForceAccepted || (meta.isStrokeBackwards && acceptBackwardsStrokes);

    if (isAccepted) {
      this._appendStrokeEvaluated(true, meta);
      this._handleSuccess(meta);
    } else {
      this._appendStrokeEvaluated(false, meta);
      this._handleFailure(meta);

      const {
        showHintAfterMisses,
        highlightColor,
        strokeHighlightSpeed,
      } = this._options!;

      if (
        showHintAfterMisses !== false &&
        this._mistakesOnStroke >= showHintAfterMisses
      ) {
        this._appendEvent({
          type: 'HintShown',
          strokeNum: this._currentStrokeIndex,
        });
        this._renderState.run(
          characterActions.highlightStroke(
            currentStroke,
            colorStringToVals(highlightColor),
            strokeHighlightSpeed,
          ),
        );
      }
    }

    this._userStroke = undefined;
  }

  cancel() {
    const wasActive = this._isActive;
    if (wasActive && this._options) {
      this._appendEvent({
        type: 'QuizCancelled',
        reason: 'user',
      });
      this._options.onComplete?.({
        events: [...this._events],
        character: this._character.symbol,
        totalMistakes: this._totalMistakes,
        canceled: true,
      });
    }
    this._isActive = false;
    if (this._userStrokesIds) {
      this._renderState.run(
        quizActions.removeAllUserStrokes( this._userStrokesIds ),
      );
    }
  }

  _quizOptionsForLog(o: ParsedHanziWriterOptions): QuizOptionsForLog {
    return {
      leniency: o.leniency,
      showHintAfterMisses: o.showHintAfterMisses,
      highlightOnComplete: o.highlightOnComplete,
      acceptBackwardsStrokes: o.acceptBackwardsStrokes,
      quizStartStrokeNum: o.quizStartStrokeNum,
      markStrokeCorrectAfterMisses: o.markStrokeCorrectAfterMisses,
      averageDistanceThreshold: o.averageDistanceThreshold,
    };
  }

  _appendEvent(event: QuizLogEventInput): void {
    const seq = this._nextSeq++;
    const msSinceQuizStart = Math.round(performance.now() - this._quizStartTime);
    this._events.push({ ...event, seq, msSinceQuizStart } as QuizLogEvent);
  }

  _appendStrokeEvaluated(accepted: boolean, meta: StrokeMatchResultMeta): void {
    this._appendEvent({
      type: 'StrokeAttemptEvaluated',
      strokeNum: this._currentStrokeIndex,
      accepted,
      ...(meta.isStrokeBackwards ? { isBackwards: true } : {}),
    });
  }

  _getStrokeData({
    isCorrect,
    meta,
  }: {
    isCorrect: boolean;
    meta: StrokeMatchResultMeta;
  }): StrokeData {
    return {
      character: this._character.symbol,
      strokeNum: this._currentStrokeIndex,
      mistakesOnStroke: this._mistakesOnStroke,
      totalMistakes: this._totalMistakes,
      strokesRemaining:
        this._character.strokes.length - this._currentStrokeIndex - (isCorrect ? 1 : 0),
      drawnPath: getDrawnPath(this._userStroke!),
      isBackwards: meta.isStrokeBackwards,
    };
  }

  nextStroke() {
    if (!this._options) return;

    const { strokes, symbol } = this._character;

    const {
      onComplete,
      highlightOnComplete,
      strokeFadeDuration,
      highlightCompleteColor,
      highlightColor,
      strokeHighlightDuration,
    } = this._options;

    let animation: GenericMutation[] = characterActions.showStroke(
      'main',
      this._currentStrokeIndex,
      strokeFadeDuration,
    );

    this._mistakesOnStroke = 0;
    this._currentStrokeIndex += 1;

    const isComplete = this._currentStrokeIndex === strokes.length;

    if (isComplete) {
      this._appendEvent({
        type: 'QuizCompleted',
        totalStrokes: strokes.length,
      });
      this._isActive = false;
      onComplete?.({
        events: [...this._events],
        character: symbol,
        totalMistakes: this._totalMistakes,
        canceled: false,
      });
      if (highlightOnComplete) {
        animation = animation.concat(
          quizActions.highlightCompleteChar(
            this._character,
            colorStringToVals(highlightCompleteColor || highlightColor),
            (strokeHighlightDuration || 0) * 2,
          ),
        );
      }
    }

    this._renderState.run(animation);
  }

  _handleSuccess(meta: StrokeMatchResultMeta) {
    if (!this._options) return;

    const { onCorrectStroke } = this._options;

    onCorrectStroke?.({
      ...this._getStrokeData({ isCorrect: true, meta }),
    });

    this.nextStroke();
  }

  _handleFailure(meta: StrokeMatchResultMeta) {
    this._mistakesOnStroke += 1;
    this._totalMistakes += 1;
    this._options!.onMistake?.(this._getStrokeData({ isCorrect: false, meta }));
  }

  _getCurrentStroke() {
    return this._character.strokes[this._currentStrokeIndex];
  }
}
