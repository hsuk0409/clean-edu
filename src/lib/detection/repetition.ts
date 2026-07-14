/**
 * 발화 반복 감지기 — STT 문장을 누적하며 "비슷한 내용이 N회 이상" 반복되는지 판정.
 * Web Speech API의 한국어 인식 결과는 조사/어미가 미세하게 달라질 수 있어(예: "환불해주세요" vs
 * "환불해주세요라니까요") 형태소 분석 없이도 견고한 문자 bi-gram Jaccard 유사도를 사용한다.
 */

export interface RepetitionDetectorOptions {
  /** 두 문장을 "같은 내용"으로 볼 유사도 임계값 (0~1) */
  similarityThreshold?: number
  /** 이 횟수에 도달하면 반복으로 판정 */
  requiredRepeats?: number
  /** 서로 다른 주제(클러스터)를 최대 몇 개까지 기억할지 — 오래된 주제는 밀려남 */
  maxClusters?: number
}

export interface RepetitionResult {
  /** 이번 push로 requiredRepeats에 도달해 반복이 확정되었는지 */
  triggered: boolean
  /** 이 문장이 속한 클러스터의 누적 횟수 */
  count: number
}

const DEFAULT_OPTIONS: Required<RepetitionDetectorOptions> = {
  similarityThreshold: 0.5,
  requiredRepeats: 3,
  maxClusters: 6,
}

function normalize(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, '')
}

function bigrams(text: string): Set<string> {
  if (text.length < 2) return new Set(text.length === 1 ? [text] : [])
  const result = new Set<string>()
  for (let i = 0; i < text.length - 1; i++) {
    result.add(text.slice(i, i + 2))
  }
  return result
}

/** 문자 bi-gram 집합 간 Jaccard 유사도 (0~1) */
export function similarity(a: string, b: string): number {
  const setA = bigrams(normalize(a))
  const setB = bigrams(normalize(b))
  if (setA.size === 0 && setB.size === 0) return normalize(a) === normalize(b) ? 1 : 0
  if (setA.size === 0 || setB.size === 0) return 0

  let intersection = 0
  for (const gram of setA) {
    if (setB.has(gram)) intersection++
  }
  const union = setA.size + setB.size - intersection
  return union === 0 ? 0 : intersection / union
}

interface Cluster {
  representative: string
  count: number
}

/**
 * 하나의 인식 결과 안에 같은 말이 여러 번 합쳐진 경우를 분해한다.
 * Web Speech API는 "안녕하세요 안녕하세요 안녕하세요"처럼 빠르게 이어 말하면 한 문장으로
 * 확정하므로, 이를 그대로 두면 반복 1회로만 집계되어 임계값에 도달하지 못한다.
 *
 * 판정 규칙(보수적): 공백으로 나눈 토큰이 2개 이상이고 서로 모두 유사할 때만 반복으로 본다.
 * ("네 네 네 알겠습니다"처럼 일부만 겹치는 정상 문장은 반복으로 오인하지 않음)
 * 공백 없이 붙은 경우(예: "안녕하세요안녕하세요")는 정확한 주기 반복만 인정한다.
 */
export function splitRepeatedUnits(
  text: string,
  similarityThreshold: number
): { unit: string; times: number } {
  const tokens = text.trim().split(/\s+/).filter(Boolean)
  if (tokens.length >= 2 && tokens.every((t) => similarity(tokens[0], t) >= similarityThreshold)) {
    return { unit: tokens[0], times: tokens.length }
  }

  const norm = normalize(text)
  for (let unitLen = 1; unitLen <= norm.length / 2; unitLen++) {
    if (norm.length % unitLen !== 0) continue
    const unit = norm.slice(0, unitLen)
    let periodic = true
    for (let i = unitLen; i < norm.length; i += unitLen) {
      if (norm.slice(i, i + unitLen) !== unit) {
        periodic = false
        break
      }
    }
    if (periodic) return { unit, times: norm.length / unitLen }
  }

  return { unit: text, times: 1 }
}

/**
 * 순서 없이(연속 발화가 아니어도) 비슷한 내용이 누적되면 감지한다.
 * 상태를 갖는 클래스이므로 통화 1건당 인스턴스 하나를 생성해 재사용해야 한다.
 */
export class RepetitionDetector {
  private clusters: Cluster[] = []
  private readonly options: Required<RepetitionDetectorOptions>

  constructor(options: RepetitionDetectorOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options }
  }

  push(text: string): RepetitionResult {
    // 한 인식 결과 안에 같은 말이 여러 번 합쳐진 경우(STT 문장 병합)를 분해해 횟수로 반영
    const { unit, times } = splitRepeatedUnits(text, this.options.similarityThreshold)
    const normalized = normalize(unit)
    if (!normalized) return { triggered: false, count: 0 }

    let best: Cluster | undefined
    let bestScore = 0
    for (const cluster of this.clusters) {
      const score = similarity(cluster.representative, normalized)
      if (score > bestScore) {
        bestScore = score
        best = cluster
      }
    }

    if (best && bestScore >= this.options.similarityThreshold) {
      best.count += times
      return { triggered: best.count >= this.options.requiredRepeats, count: best.count }
    }

    this.clusters.push({ representative: normalized, count: times })
    if (this.clusters.length > this.options.maxClusters) {
      this.clusters.shift()
    }
    return { triggered: times >= this.options.requiredRepeats, count: times }
  }

  reset(): void {
    this.clusters = []
  }
}
