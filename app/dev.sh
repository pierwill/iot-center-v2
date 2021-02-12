#!/bin/bash

#export INFLUX_URL=https://us-west-2-1.aws.cloud2.influxdata.com
export INFLUX_URL=<copy url from your web browser>
#export INFLUX_TOKEN=h14b3X2n4kc8Q_jYPpwdjkv3dAZRorNQnN67pMwKs1lGgbMW8vWRjAi7VvkUitQMii2XwJM9qX3cnK4oAZDIjg==
export INFLUX_TOKEN=<generated token in the InfluxDB UI>
#export INFLUX_ORG=iotCenter@influxdata.com
export INFLUX_ORG=<your email>

yarn dev
