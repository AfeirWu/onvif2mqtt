import logger from '../Logger';
import Subscriber from './Subscriber';

const NO_OP = () => {};

export default class SubscriberGroup {
  subscribers = [];

  constructor(callbacks = {}) {
    this.callbacks = callbacks;
    this.logger = logger.child({ name: 'ONVIF' });
  }

  withCallback = (eventType, callback) => {
    this.callbacks[eventType] = callback || NO_OP;
  };

  addSubscriber = (subscriberConfig) => {
    this.subscribers.push(
      new Subscriber({
        ...subscriberConfig,
        onEvent: this.onSubscriberEvent,
      })
    );
  };

  destroy = () => {
    this.subscribers.forEach((subscriber) => {
      subscriber.cam = null;
    });
    this.subscribers = [];
  };

  parseSimpleItemsToObject = (simpleItems) => {
    return simpleItems.reduce(
      (result, item) => ({
        ...result,
        [item.$.Name]: item.$.Value,
      }),
      {}
    );
  };

  onSubscriberEvent = (subscriberName, event) => {
    const { topic, message } = event;
    const eventType = topic._; // Extract event type from the topic

    const { data } = message.message;
    const simpleItems = Array.isArray(data.simpleItem)
      ? data.simpleItem
      : [data.simpleItem];
    const eventValue = this.parseSimpleItemsToObject(simpleItems);

    this.logger.trace('ONVIF event received', {
      subscriberName,
      eventType,
      eventValue,
    });

    const callback = this.callbacks[eventType] || NO_OP;
    callback(subscriberName, eventValue);
  };
}
     