#!/usr/bin/env bash
# One-shot setup for an Ubuntu 24.04 EC2 instance:
# installs Docker, Java 21, Jenkins, kubectl and Minikube, then starts Minikube
# as the "jenkins" user so Jenkins pipelines can deploy to it.
# Run as the normal "ubuntu" user (NOT with sudo):   bash scripts/setup-ec2.sh
set -euo pipefail

echo "==> [1/6] Installing Docker, Java 21 and basic tools"
sudo apt-get update
sudo apt-get install -y docker.io git curl conntrack fontconfig openjdk-21-jre
sudo systemctl enable --now docker
sudo usermod -aG docker "$USER"
java -version

echo "==> [2/6] Installing Jenkins (LTS) from the official repository"
sudo mkdir -p /etc/apt/keyrings
sudo wget -O /etc/apt/keyrings/jenkins-keyring.asc \
  https://pkg.jenkins.io/debian-stable/jenkins.io-2026.key
echo "deb [signed-by=/etc/apt/keyrings/jenkins-keyring.asc] https://pkg.jenkins.io/debian-stable binary/" \
  | sudo tee /etc/apt/sources.list.d/jenkins.list > /dev/null
sudo apt-get update
sudo apt-get install -y jenkins

echo "==> [3/6] Letting Jenkins use Docker"
sudo usermod -aG docker jenkins
sudo systemctl enable jenkins
sudo systemctl restart jenkins

echo "==> [4/6] Installing kubectl"
KVER="$(curl -fsSL https://dl.k8s.io/release/stable.txt)"
curl -fsSLo /tmp/kubectl "https://dl.k8s.io/release/${KVER}/bin/linux/amd64/kubectl"
sudo install /tmp/kubectl /usr/local/bin/kubectl

echo "==> [5/6] Installing Minikube"
curl -fsSLo /tmp/minikube https://storage.googleapis.com/minikube/releases/latest/minikube-linux-amd64
sudo install /tmp/minikube /usr/local/bin/minikube

echo "==> [6/6] Starting Minikube as the jenkins user (takes a few minutes)"
sudo -u jenkins -H minikube start --driver=docker
sudo -u jenkins -H kubectl get nodes

echo
echo "DONE. Jenkins admin password:"
sudo cat /var/lib/jenkins/secrets/initialAdminPassword
echo
echo "Open http://<EC2-PUBLIC-IP>:8080 and paste that password."
