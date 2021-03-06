import DS from 'ember-data';
import Ember from 'ember';

export default DS.Model.extend({
  type: DS.attr('string'),
  status: DS.attr('string', {defaultValue: 'queued'}),
  createdAt: DS.attr('iso-8601-timestamp'),
  userName: DS.attr('string'),
  userEmail: DS.attr('string'),
  gitRef: DS.attr('string'),

  // provisioning databases
  diskSize: DS.attr('number'),

  // scaling services
  containerSize: DS.attr('number'), // when scaling size of container
  containerCount: DS.attr('number'), // when scaling number of containers

  // vhosts
  certificate: DS.attr(),
  privateKey: DS.attr(),

  // append these values for a nested url. They are
  // not actual attributes in the server payload, and
  // as such not ember-data `attrs`.
  database: null,
  app: null,
  vhost: null,
  logDrain: null,
  service: null,

  reloadUntilStatusChanged: function(maximumTimeout) {
    let reloadUntilOperationStatusChanged = (operation, maximumTimeout, timeout) => {
      return operation.reload().then((o) => {
        return new Ember.RSVP.Promise((resolve, reject) => {
          if(timeout > maximumTimeout) {
            return reject(new Error('Operation timed out.'));
          }

          let status = o.get('status');
          if(status === 'succeeded') {
            return resolve(o);
          } else if(status === 'failed') {
            return reject(new Error('Operation failed.'));
          }

          Ember.run.later(o, () => {
            return resolve(reloadUntilOperationStatusChanged(o, maximumTimeout, timeout * 2));
          }, timeout);
        });
      });
    };

    return reloadUntilOperationStatusChanged(this, maximumTimeout, 1000)
  }

});
