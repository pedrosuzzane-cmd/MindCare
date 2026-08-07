/**
 * Keyword Detector (Local Engine Stage 2).
 *
 * Weighted keyword banks power the topic detector: each keyword match adds
 * points to its topic's score. Facade re-exports the banks and scoring from
 * topicDetector so the pipeline reads: keyword → topic.
 */
export {
  TOPIC_KEYWORDS,
  TOPIC_LABELS,
  detectTopics,
  getTopicLabel,
} from "./topicDetector";
export type { KeywordEntry, TopicScore } from "./topicDetector";
