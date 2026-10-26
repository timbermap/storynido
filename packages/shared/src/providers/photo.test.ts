import { describe, expect, it } from 'vitest';

import { evaluatePhoto, type PhotoAnalysis } from './photo';

const face = { left: 400, top: 400, width: 400, height: 450, confidence: 0.98 };

const good: PhotoAnalysis = {
  width: 1200,
  height: 1600,
  faces: [face],
  brightness: 130,
  sharpness: 25,
  inappropriate: 'very_unlikely',
};

describe('evaluatePhoto', () => {
  it('acepta una foto con una cara clara, nítida y bien iluminada', () => {
    expect(evaluatePhoto(good)).toEqual([]);
  });

  it('rechaza sin cara o con varias personas', () => {
    expect(evaluatePhoto({ ...good, faces: [] })).toEqual(['no_face']);
    const second = { left: 0, top: 0, width: 300, height: 300, confidence: 0.9 };
    expect(evaluatePhoto({ ...good, faces: [...good.faces, second] })).toEqual(['multiple_faces']);
  });

  it('ignora detecciones dudosas', () => {
    const doubtful = { left: 0, top: 0, width: 50, height: 50, confidence: 0.3 };
    expect(evaluatePhoto({ ...good, faces: [...good.faces, doubtful] })).toEqual([]);
  });

  it('detecta cara muy chica, poca resolución, luz y nitidez', () => {
    expect(evaluatePhoto({ ...good, faces: [{ ...face, width: 60, height: 60 }] })).toContain(
      'face_too_small',
    );
    expect(evaluatePhoto({ ...good, width: 400, height: 300 })).toContain('low_resolution');
    expect(evaluatePhoto({ ...good, brightness: 20 })).toEqual(['too_dark']);
    expect(evaluatePhoto({ ...good, brightness: 250 })).toEqual(['too_bright']);
    expect(evaluatePhoto({ ...good, sharpness: 2 })).toEqual(['blurry']);
  });

  it('el contenido inapropiado se rechaza sin más detalle', () => {
    expect(evaluatePhoto({ ...good, inappropriate: 'likely', brightness: 10 })).toEqual([
      'inappropriate',
    ]);
  });
});
