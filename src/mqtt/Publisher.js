import MQTT from 'async-mqtt';
import logger from '../Logger';

const HOMEASSISTANT_PREFIX = 'homeassistant/';

const DEFAULT_OPTIONS = {
};

export default class MqttPublisher {
  client;

  constructor(userOptions) {
    this.options = { ...DEFAULT_OPTIONS, ...userOptions };

    const { host, port, clientId } = this.options;
    this.logger = logger.child({ name: 'MQTT', hostname: `${host}:${port} ${clientId || ''}` });
  }

  connect = async () => {
    this.logger.info('Connecting.');

    this.client = await MQTT.connectAsync(this.options);

    this.logger.info('Successfully connected.');
  };

  publishEvent = async (onvifId, eventData) => {
    const { eventType, params } = eventData;
    const sanitizedType = eventType.replace(/\//g, '_');
    const baseTopic = `onvif2mqtt/${onvifId}/${sanitizedType}`;

    try {
      this.logger.debug('Publishing full event data', {
        topic: baseTopic,
        params
      });

      await Promise.all([
        this.client.publish(`${baseTopic}/params`, JSON.stringify(params), { retain: false }),
        this.client.publish(`${baseTopic}/full`, JSON.stringify(eventData), { retain: false })
      ]);
    } catch (e) {
      this.logger.error('Failed to publish event', {
        error: e,
        eventType,
        params
      });
    }
  };

  publish_service_status = async (value, retain = true) => {
    const topic = `onvif2mqtt/status`;

    try {
      this.logger.debug('Publishing.', { topic, value, retain });
      await this.client.publish(`onvif2mqtt/status`, value, { retain });
    } catch (e) {
      this.logger.error('Failed to publish', { error: e, topic, value, retain });
    }
  };
}
   