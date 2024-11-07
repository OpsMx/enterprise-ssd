#!/bin/bash
#The below script deploys a sample application

set -x #Debug mode details ON

helm list -A
kubectl get storageclass
kubectl get ingressclass

#Create a dedicated namespace for testing
kubectl create ns test

#Create a sample web application as deployment
kubectl -n test create deployment web --image=gcr.io/google-samples/hello-app:1.0

#Create NodePort service for LoadBalancer to send traffic to
kubectl -n test expose deployment web --type=NodePort --port=8080

#Apply the PVC yaml file to setup a PVC
kubectl -n test apply -f pvc-test.yml

#Create a LB objects (Ingress and Service), they should create a Load Balancers automatically
kubectl -n test apply -f lb-test.yml

#Wait for a 30 secs for provisioning
echo "Waiting for 30 secs for provisioning"
sleep 30

#Check if the new PVC has been provisioned
kubectl -n test get pvc

#Verify if a Load Balancer is created
kubectl -n test get ing
kubectl -n test get svc

#Verify if ALB and NLB is connecting (any one command is enough)
#nc -zv <LB_HOST> <LB_PORT> #[or]
#telnet -v <LB_HOST> <LB_PORT> #[or]
#curl -v telnet://<LB_HOST>:<LB_PORT>

# Clean the LB resources including Ing and Svc
#kubectl -n test delete -f lb-test.yml

set +x #Debug mode details OFF
