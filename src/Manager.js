import _config from './Config';
import logger from './Logger';
import OnvifSubscriberGroup from './onvif/SubscriberGroup';
import MqttPublisher from './mqtt/Publisher';

import process from 'process';

import debounceStateUpdate from './utils/debounceStateUpdate';
import interpolateTemplateValues from './utils/interpolateTemplateValues';

const convertBooleanToSensorState = (bool) => (bool ? 'ON' : 'OFF');

export default class Manager {
  constructor() {
    this.logger = logger.child({ name: 'Manager' });
    this.config = new _config(() => {
      this.initializeOnvifDevicesFunctions();
    });

    this.init();
  }

  init = async () => {
    this.logger.info('Beginning initialization...');

    this.publisher = new MqttPublisher(this.config.get('mqtt'));
    await this.publisher.connect();
    await this.publisher.publish_service_status('ON');

    this.subscriber = new OnvifSubscriberGroup();
    this.initializeOnvifDevicesFunctions();

    this.onExitSendStatus();
  };

  initializeOnvifDevicesFunctions = () => {
    this.subscriber.destroy();

    // Add default callback for all event types
    this.subscriber.withCallback(undefined, this.onGenericEvent);

    // Initialize devices
    this.initializeOnvifDevices(this.config.get('onvif'));
  };

  initializeOnvifDevices = (devices) => {
    devices.forEach(async (onvifDevice) => {
      await this.subscriber.addSubscriber(onvifDevice);
    });
  };

  publishTemplates = (onvifDeviceId, eventType, eventState) => {
    const templates = this.config.get('api.templates');

    if (!templates) {
      return;
    }

    templates.forEach(({ subtopic, template, retain }) => {
      const interpolationValues = {
        onvifDeviceId,
        eventType,
        eventState,
      };

      const interpolatedSubtopic = interpolateTemplateValues(
        subtopic,
        interpolationValues
      );
      const interpolatedTemplate = interpolateTemplateValues(
        template,
        interpolationValues
      );

      this.publisher.publish(
        onvifDeviceId,
        interpolatedSubtopic,
        interpolatedTemplate,
        retain
      );
    });
  };

  /* Event Callbacks */
  onGenericEvent = (onvifDeviceId, eventState) => {
    this.logger.info(`Generic Event: ${onvifDeviceId}`, { eventState });
    Object.keys(eventState).forEach((eventType) => {
      const value = eventState[eventType];
      this.publishTemplates(onvifDeviceId, eventType, value);
      this.publisher.publish(
        onvifDeviceId,
        eventType,
        convertBooleanToSensorState(value)
      );
    });
  };

  onExitSendStatus = () => {
    const exitHandler = async (code) => {
      await this.publisher.publish_service_status('OFF');
      process.exit(code);
    };

    process.on('SIGTERM', () => exitHandler(0));
    process.on('SIGINT', () => exitHandler(0));
    process.on('beforeExit', (code) => exitHandler(code));
  };
}
       