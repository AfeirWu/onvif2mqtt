import logger from '../Logger';
import Subscriber from './Subscriber';

const NO_OP = () => {};

const NAMESPACE_DELIMITER = ':';

export const CALLBACK_TYPES = {
  event: 'onEventReceived',
};

const DEFAULT_CALLBACKS = {
  [CALLBACK_TYPES.event]: NO_OP,
};

export default class SubscriberGroup {
  subscribers = [];

  constructor(callbacks) {
    this.callbacks = {
      ...DEFAULT_CALLBACKS,
      ...callbacks
    };
    this.logger = logger.child({ name: 'ONVIF' });
  }

  withCallback = (callbackType, callback) => {
    this.callbacks = {
      ...this.callbacks,
      [callbackType]: callback,
    };
  };

  addSubscriber = (subscriberConfig) => {
    this.subscribers.push(new Subscriber({
      ...subscriberConfig,
      onEvent: this.onSubscriberEvent,
    }));
  };

  destroy = () => {
    this.subscribers.forEach((item) => {
      item.cam = null;
      item = null;
    });
    this.subscribers.length = 0;
  };

  onSubscriberEvent = (subscriberName, event) => {
    try {
      const [namespace, eventType] = event.topic._.split(NAMESPACE_DELIMITER);
      const simpleItems = event.message.message.data.simpleItem;

      const eventValue = {
        timestamp: event.message.message.$.UtcTime,
        eventType: eventType,
        namespace: namespace,
        params: {}
      };

      if (simpleItems) {
        const items = Array.isArray(simpleItems) ? simpleItems : [simpleItems];
        items.forEach(item => {
          eventValue.params[item.$.Name] = item.$.Value;
        });
      }

      this.logger.trace('ONVIF Event Received', {
        subscriberName,
        eventType: eventType,
        params: eventValue.params
      });

      this.callbacks[CALLBACK_TYPES.event](subscriberName, eventValue);
    } catch (error) {
      this.logger.error('Error processing event', { error });
    }
  };
}
        