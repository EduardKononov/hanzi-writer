import { showPartialCharacter } from '../characterActions';
import Character from '../models/Character';
import Stroke from '../models/Stroke';

function strokeAt(i: number) {
  return new Stroke('M0 0', [{ x: 0, y: 0 }], i, false);
}

describe('showPartialCharacter', () => {
  it('shows the first visibleStrokeCount strokes and hides the rest', async () => {
    const character = new Character('测', [strokeAt(0), strokeAt(1), strokeAt(2)]);
    const [mut] = showPartialCharacter('main', character, 2, 0);
    const renderState = {
      state: {},
      updateState: jest.fn(),
    };
    await mut.run(renderState as any);
    expect(renderState.updateState).toHaveBeenCalledWith({
      character: {
        main: {
          opacity: 1,
          strokes: {
            0: { opacity: 1, displayPortion: 1 },
            1: { opacity: 1, displayPortion: 1 },
            2: { opacity: 0, displayPortion: 1 },
          },
        },
      },
    });
  });

  it('clamps visibleStrokeCount below zero to zero', async () => {
    const character = new Character('一', [strokeAt(0)]);
    const [mut] = showPartialCharacter('main', character, -3, 0);
    const renderState = {
      state: {},
      updateState: jest.fn(),
    };
    await mut.run(renderState as any);
    expect(renderState.updateState).toHaveBeenCalledWith({
      character: {
        main: {
          opacity: 1,
          strokes: {
            0: { opacity: 0, displayPortion: 1 },
          },
        },
      },
    });
  });

  it('clamps visibleStrokeCount above stroke length', async () => {
    const character = new Character('二', [strokeAt(0), strokeAt(1)]);
    const [mut] = showPartialCharacter('main', character, 99, 0);
    const renderState = {
      state: {},
      updateState: jest.fn(),
    };
    await mut.run(renderState as any);
    expect(renderState.updateState).toHaveBeenCalledWith({
      character: {
        main: {
          opacity: 1,
          strokes: {
            0: { opacity: 1, displayPortion: 1 },
            1: { opacity: 1, displayPortion: 1 },
          },
        },
      },
    });
  });
});
