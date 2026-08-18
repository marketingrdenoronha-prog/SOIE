import { test } from "node:test";
import assert from "node:assert/strict";
import {
  clampSlideCount,
  reconcileCarouselSlides,
  effectiveSlideCount,
  CAROUSEL_MIN_SLIDES,
  CAROUSEL_MAX_SLIDES,
  CAROUSEL_DEFAULT_SLIDES,
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
