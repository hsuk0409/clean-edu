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
    const normalized = normalize(text)
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
      best.count += 1
      return { triggered: best.count >= this.options.requiredRepeats, count: best.count }
    }

    this.clusters.push({ representative: normalized, count: 1 })
    if (this.clusters.length > this.options.maxClusters) {
      this.clusters.shift()
    }
    return { triggered: false, count: 1 }
  }

  reset(): void {
    this.clusters = []
  }
}
