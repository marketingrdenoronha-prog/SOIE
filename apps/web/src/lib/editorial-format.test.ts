import { test } from "node:test";
import assert from "node:assert/strict";
import {
  clampSlideCount,
  reconcileCarouselSlides,
  effectiveSlideCount,
  clampDuration,
  formatDuration,
  normalizeTheme,
  reconcileContentConfigs,
  CAROUSEL_MIN_SLIDES,
  CAROUSEL_MAX_SLIDES,
  CAROUSEL_DEFAULT_SLIDES,
  VIDEO_DEFAULT_DURATION,
  MOTION_DEFAULT_DURATION,
} from "./editorial-format.ts";

test("clampSlideCount força inteiro dentro de [2,8]", () => {
  assert.equal(clampSlideCount(1), CAROUSEL_MIN_SLIDES); // rejeita 1 tela
  assert.equal(clampSlideCount(9), CAROUSEL_MAX_SLIDES); // rejeita 9 telas
  assert.equal(clampSlideCount(5), 5);
  assert.equal(clampSlideCount(4.6), 5); // decimal → inteiro
  assert.equal(clampSlideCount("nao-numero"), CAROUSEL_DEFAULT_SLIDES);
});

test("reconcileCarouselSlides preserva existentes, adiciona padrão e remove excedentes", () => {
  // aumentar 2 → 4 preserva os dois primeiros e completa com padrão
  assert.deepEqual(reconcileCarouselSlides([4, 7], 4), [4, 7, CAROUSEL_DEFAULT_SLIDES, CAROUSEL_DEFAULT_SLIDES]);
  // reduzir 4 → 2 remove as excedentes
  assert.deepEqual(reconcileCarouselSlides([4, 7, 3, 6], 2), [4, 7]);
  // 0 carrosséis → lista vazia
  assert.deepEqual(reconcileCarouselSlides([4, 7], 0), []);
  // valores inválidos são clampeados
  assert.deepEqual(reconcileCarouselSlides([1, 99], 2), [CAROUSEL_MIN_SLIDES, CAROUSEL_MAX_SLIDES]);
});

test("effectiveSlideCount usa slideCount, senão deriva do nº de telas (compat. antigos)", () => {
  assert.equal(effectiveSlideCount({ format: "carrossel", slideCount: 6, slides: [] }), 6);
  // dado antigo sem slideCount → deriva do array
  assert.equal(effectiveSlideCount({ format: "carrossel", slides: [{ text: "a" }, { text: "b" }, { text: "c" }] }), 3);
  assert.equal(effectiveSlideCount({ format: "carrossel" }), undefined);
  assert.equal(effectiveSlideCount(null), undefined);
});

test("clampDuration exige inteiro positivo, senão usa o fallback", () => {
  assert.equal(clampDuration(0, 30), 30);
  assert.equal(clampDuration(-5, 30), 30);
  assert.equal(clampDuration("x", 15), 15);
  assert.equal(clampDuration(30, 30), 30);
  assert.equal(clampDuration(30.4, 30), 30);
  assert.equal(clampDuration(999999, 30), 3600); // teto de segurança
});

test("formatDuration formata segundos legíveis", () => {
  assert.equal(formatDuration(30), "30s");
  assert.equal(formatDuration(60), "1min");
  assert.equal(formatDuration(65), "1min05s");
  assert.equal(formatDuration(90), "1min30s");
});

test("normalizeTheme: vazio/espacos -> undefined; texto -> trim", () => {
  assert.equal(normalizeTheme("   "), undefined);
  assert.equal(normalizeTheme(""), undefined);
  assert.equal(normalizeTheme(undefined), undefined);
  assert.equal(normalizeTheme("  Prova social "), "Prova social");
});

test("reconcileContentConfigs cria por formato com padrões corretos", () => {
  const out = reconcileContentConfigs({}, { video: 2, motion: 0, carrossel: 1, estatico: 3 } as any);
  assert.equal(out.video.length, 2);
  assert.equal(out.video[0].durationSeconds, VIDEO_DEFAULT_DURATION);
  assert.equal(out.motion.length, 0);
  assert.equal(out.carrossel.length, 1);
  assert.equal(out.carrossel[0].slideCount, CAROUSEL_DEFAULT_SLIDES);
  assert.equal(out.estatico.length, 3);
  assert.equal(out.estatico[0].theme, "");
});

test("reconcileContentConfigs preserva valores digitados ao aumentar e trunca ao reduzir", () => {
  const prev = {
    video: [{ theme: "A", durationSeconds: 60 }, { theme: "B", durationSeconds: 90 }],
  } as any;
  const grown = reconcileContentConfigs(prev, { video: 4, motion: 0, carrossel: 0, estatico: 0 } as any);
  assert.deepEqual(grown.video[0], { theme: "A", durationSeconds: 60 });
  assert.deepEqual(grown.video[1], { theme: "B", durationSeconds: 90 });
  assert.equal(grown.video[2].durationSeconds, VIDEO_DEFAULT_DURATION); // novo = padrão
  assert.equal(grown.video.length, 4);
  const shrunk = reconcileContentConfigs(prev, { video: 1, motion: 0, carrossel: 0, estatico: 0 } as any);
  assert.equal(shrunk.video.length, 1);
  assert.equal(shrunk.video[0].theme, "A");
  void MOTION_DEFAULT_DURATION;
});
